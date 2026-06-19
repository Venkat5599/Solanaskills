import type { ComplianceConfig, DecryptedTransfer, Flag } from "../types.ts";
import { ComplianceState } from "../state.ts";
import { defaultRules, type Rule, type RuleContext } from "./rules.ts";

/**
 * Stateful AML engine. Feed it decrypted transfers one at a time (in block
 * order); it updates the rolling state and returns any flags raised for each.
 *
 * Deterministic: same transfers in the same order always yield the same flags.
 */
export class ComplianceEngine {
  readonly state: ComplianceState;
  private readonly rules: Rule[];

  constructor(
    private readonly cfg: ComplianceConfig,
    rules: Rule[] = defaultRules,
  ) {
    this.state = new ComplianceState(cfg.windowMs);
    this.rules = rules;
  }

  /** Process one transfer; returns flags raised by this transfer. */
  ingest(transfer: DecryptedTransfer): Flag[] {
    // Capture pre-record dormancy info, then record so window rules see this transfer.
    const priorActivitySource = this.state.lastActivityBefore(transfer.source, transfer.blockTime);
    this.state.record(transfer);

    const ctx: RuleContext = { transfer, state: this.state, cfg: this.cfg, priorActivitySource };
    const flags: Flag[] = [];
    for (const rule of this.rules) flags.push(...rule(ctx));
    this.state.prune(transfer.blockTime);
    return flags;
  }

  /** Convenience: process a batch in order, returning all flags. */
  ingestBatch(transfers: DecryptedTransfer[]): Flag[] {
    const all: Flag[] = [];
    for (const t of transfers) all.push(...this.ingest(t));
    return all;
  }
}
