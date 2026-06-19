import type { DecryptedTransfer } from "./types.ts";

export type Direction = "in" | "out";

export interface TransferEvent {
  signature: string;
  blockTime: number;
  amount: bigint;
  /** The other side of the transfer relative to the account this event is filed under. */
  counterparty: string;
  direction: Direction;
}

/**
 * Rolling per-account ledger of decrypted transfer events.
 *
 * Pure in-memory aggregate with time-window queries. Deterministic and fully
 * testable without any network or crypto. `lastActivity` is tracked separately
 * and never pruned so dormancy detection survives window pruning.
 */
export class ComplianceState {
  private events = new Map<string, TransferEvent[]>();
  private lastSeen = new Map<string, number>();

  constructor(private readonly windowMs: number) {}

  /** Files this transfer as an OUT event on source and an IN event on destination. */
  record(t: DecryptedTransfer): void {
    this.push(t.source, {
      signature: t.signature,
      blockTime: t.blockTime,
      amount: t.amount,
      counterparty: t.destination,
      direction: "out",
    });
    this.push(t.destination, {
      signature: t.signature,
      blockTime: t.blockTime,
      amount: t.amount,
      counterparty: t.source,
      direction: "in",
    });
  }

  private push(account: string, ev: TransferEvent): void {
    const list = this.events.get(account) ?? [];
    list.push(ev);
    this.events.set(account, list);
    this.lastSeen.set(account, Math.max(this.lastSeen.get(account) ?? 0, ev.blockTime));
  }

  /** Activity timestamp before `now`, or undefined if the account is new. */
  lastActivityBefore(account: string, now: number): number | undefined {
    const list = this.events.get(account);
    if (!list) return undefined;
    let last: number | undefined;
    for (const ev of list) {
      if (ev.blockTime < now && (last === undefined || ev.blockTime > last)) last = ev.blockTime;
    }
    return last;
  }

  private within(account: string, dir: Direction, now: number): TransferEvent[] {
    const since = now - this.windowMs;
    return (this.events.get(account) ?? []).filter((e) => e.direction === dir && e.blockTime >= since);
  }

  recentOut(account: string, now: number): TransferEvent[] {
    return this.within(account, "out", now);
  }

  recentIn(account: string, now: number): TransferEvent[] {
    return this.within(account, "in", now);
  }

  volumeOut(account: string, now: number): bigint {
    return this.recentOut(account, now).reduce((sum, e) => sum + e.amount, 0n);
  }

  countOut(account: string, now: number): number {
    return this.recentOut(account, now).length;
  }

  /** Drop events older than the window to bound memory. Keeps lastSeen intact. */
  prune(now: number): void {
    const since = now - this.windowMs;
    for (const [account, list] of this.events) {
      const kept = list.filter((e) => e.blockTime >= since);
      if (kept.length === 0) this.events.delete(account);
      else this.events.set(account, kept);
    }
  }
}
