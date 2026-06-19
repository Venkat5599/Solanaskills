import type { ComplianceConfig, DecryptedTransfer, Flag } from "../types.ts";
import type { ComplianceState } from "../state.ts";

/**
 * AML rule catalog for decrypted confidential transfers.
 *
 * Every rule is a pure function: (context) -> Flag[]. No I/O, no clock, no
 * randomness — give it the same context and it returns the same flags. That is
 * what makes the whole compliance engine unit-testable offline.
 *
 * These patterns are exactly the ones that confidential transfers hide from the
 * public chain. Only the holder of the mint's auditor ElGamal key can decrypt
 * the amounts and therefore only this loop can catch them. That is the moat.
 */
export interface RuleContext {
  transfer: DecryptedTransfer;
  /** State already includes `transfer` (recorded before rules run). */
  state: ComplianceState;
  cfg: ComplianceConfig;
  /** Source's last activity timestamp BEFORE this transfer (for dormancy). */
  priorActivitySource?: number;
}

export type Rule = (ctx: RuleContext) => Flag[];

/** CTR-style: any single transfer at/above the report threshold. */
export const thresholdRule: Rule = ({ transfer, cfg }) => {
  if (transfer.amount < cfg.reportThreshold) return [];
  return [
    {
      rule: "threshold",
      severity: "high",
      signature: transfer.signature,
      account: transfer.source,
      message: `Transfer of ${transfer.amount} >= report threshold ${cfg.reportThreshold}`,
      evidence: { amount: transfer.amount.toString(), threshold: cfg.reportThreshold.toString() },
    },
  ];
};

/** Sanctioned / denylisted counterparty on either side. */
export const sanctionedRule: Rule = ({ transfer, cfg }) => {
  const flags: Flag[] = [];
  for (const acct of [transfer.source, transfer.destination]) {
    if (cfg.sanctioned.has(acct)) {
      flags.push({
        rule: "sanctioned",
        severity: "high",
        signature: transfer.signature,
        account: acct,
        message: `Transfer touches sanctioned/denylisted account ${acct}`,
      });
    }
  }
  return flags;
};

/**
 * Structuring (smurfing): a big payment split into several sub-threshold
 * transfers that together cross the report threshold inside the window.
 */
export const structuringRule: Rule = ({ transfer, state, cfg }) => {
  const outs = state
    .recentOut(transfer.source, transfer.blockTime)
    .filter((e) => e.amount < cfg.reportThreshold);
  if (outs.length < 3) return [];
  const total = outs.reduce((s, e) => s + e.amount, 0n);
  if (total < cfg.reportThreshold) return [];
  return [
    {
      rule: "structuring",
      severity: "high",
      signature: transfer.signature,
      account: transfer.source,
      message: `${outs.length} sub-threshold transfers summing ${total} >= threshold within window`,
      evidence: { count: outs.length, total: total.toString(), windowMs: cfg.windowMs },
    },
  ];
};

/** Velocity: aggregate out-volume or out-count over the window limit. */
export const velocityRule: Rule = ({ transfer, state, cfg }) => {
  const volume = state.volumeOut(transfer.source, transfer.blockTime);
  const count = state.countOut(transfer.source, transfer.blockTime);
  const flags: Flag[] = [];
  if (volume > cfg.velocityVolumeLimit) {
    flags.push({
      rule: "velocity-volume",
      severity: "medium",
      signature: transfer.signature,
      account: transfer.source,
      message: `Out-volume ${volume} exceeds window limit ${cfg.velocityVolumeLimit}`,
      evidence: { volume: volume.toString(), limit: cfg.velocityVolumeLimit.toString() },
    });
  }
  if (count > cfg.velocityCountLimit) {
    flags.push({
      rule: "velocity-count",
      severity: "medium",
      signature: transfer.signature,
      account: transfer.source,
      message: `Out-count ${count} exceeds window limit ${cfg.velocityCountLimit}`,
      evidence: { count, limit: cfg.velocityCountLimit },
    });
  }
  return flags;
};

/** Funnel/mule: most of an account's out-volume goes to one counterparty. */
export const concentrationRule: Rule = ({ transfer, state, cfg }) => {
  const outs = state.recentOut(transfer.source, transfer.blockTime);
  if (outs.length < cfg.concentrationMinEvents) return [];
  const total = outs.reduce((s, e) => s + e.amount, 0n);
  if (total === 0n) return [];
  const byPeer = new Map<string, bigint>();
  for (const e of outs) byPeer.set(e.counterparty, (byPeer.get(e.counterparty) ?? 0n) + e.amount);
  let topPeer = "";
  let topVol = 0n;
  for (const [peer, vol] of byPeer) if (vol > topVol) [topPeer, topVol] = [peer, vol];
  // ratio as integer math: topVol/total >= concentrationRatio
  const thresholdVol = (total * BigInt(Math.round(cfg.concentrationRatio * 1000))) / 1000n;
  if (topVol < thresholdVol) return [];
  return [
    {
      rule: "concentration",
      severity: "medium",
      signature: transfer.signature,
      account: transfer.source,
      message: `${topVol}/${total} of out-volume concentrated to single peer ${topPeer}`,
      evidence: { peer: topPeer, peerVolume: topVol.toString(), total: total.toString() },
    },
  ];
};

/** Layering: funds received then forwarded quickly (pass-through account). */
export const layeringRule: Rule = ({ transfer, state, cfg }) => {
  const ins = state
    .recentIn(transfer.source, transfer.blockTime)
    .filter(
      (e) =>
        e.signature !== transfer.signature &&
        transfer.blockTime - e.blockTime <= cfg.layeringWindowMs &&
        e.amount >= transfer.amount,
    );
  if (ins.length === 0) return [];
  const fastest = ins.reduce((a, b) => (a.blockTime > b.blockTime ? a : b));
  return [
    {
      rule: "layering",
      severity: "medium",
      signature: transfer.signature,
      account: transfer.source,
      message: `Out ${transfer.amount} shortly after in ${fastest.amount} — pass-through pattern`,
      evidence: { gapMs: transfer.blockTime - fastest.blockTime, inSig: fastest.signature },
    },
  ];
};

/** Dormant account suddenly moves a material amount. */
export const dormancyRule: Rule = ({ transfer, cfg, priorActivitySource }) => {
  if (priorActivitySource === undefined) return [];
  const gap = transfer.blockTime - priorActivitySource;
  const material = cfg.reportThreshold / 10n;
  if (gap <= cfg.dormancyMs || transfer.amount < material) return [];
  return [
    {
      rule: "dormancy",
      severity: "medium",
      signature: transfer.signature,
      account: transfer.source,
      message: `Account idle ${Math.round(gap / 86_400_000)}d then moved ${transfer.amount}`,
      evidence: { idleDays: Math.round(gap / 86_400_000), amount: transfer.amount.toString() },
    },
  ];
};

/** Default ruleset, ordered by signal strength. */
export const defaultRules: Rule[] = [
  sanctionedRule,
  thresholdRule,
  structuringRule,
  velocityRule,
  concentrationRule,
  layeringRule,
  dormancyRule,
];
