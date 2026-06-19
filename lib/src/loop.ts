import type {
  AuditorDecryptor,
  ConfidentialTransferRecord,
  DecryptedTransfer,
  Flag,
} from "./types.ts";
import type { ComplianceEngine } from "./aml/engine.ts";
import { BudgetLedger } from "./budget.ts";
import { buildReport, type ComplianceReport } from "./report.ts";

export interface LoopCursor {
  lastSlot: number;
  processed: number;
}

export interface ConfidentialComplianceLoopConfig {
  mint: string;
  auditorPubkey: string;
  decryptor: AuditorDecryptor;
  engine: ComplianceEngine;
  budget: BudgetLedger;
  /** Fetch confidential transfer records newer than the cursor (RPC/Helius). */
  observe: (cursor: LoopCursor) => Promise<ConfidentialTransferRecord[]>;
  onFlags?: (flags: Flag[]) => void | Promise<void>;
  onReport?: (report: ComplianceReport) => void | Promise<void>;
  /** Poll interval when there is nothing new. Default 15s. */
  intervalMs?: number;
  /** Emit a report after this many newly-processed transfers. Default 500. */
  reportEveryN?: number;
  /** Injectable sleeper (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock. */
  now?: () => number;
}

export interface TickResult {
  records: number;
  flags: Flag[];
  report?: ComplianceReport;
}

/**
 * The auditor compliance loop: observe → decrypt → assess → report → repeat.
 *
 * The loop holds the auditor's trust boundary. It decrypts ONLY the mint it is
 * authorized to audit, runs the deterministic AML engine, and emits hashed
 * reports. Termination is guaranteed by the BudgetLedger.
 */
export class ConfidentialComplianceLoop {
  private cursor: LoopCursor = { lastSlot: 0, processed: 0 };
  private sinceReport = 0;
  private totalVolume = 0n;
  private flagBuffer: Flag[] = [];
  private periodStart: number;
  private stopped = false;

  private readonly intervalMs: number;
  private readonly reportEveryN: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly cfg: ConfidentialComplianceLoopConfig) {
    this.intervalMs = cfg.intervalMs ?? 15_000;
    this.reportEveryN = cfg.reportEveryN ?? 500;
    this.sleep = cfg.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = cfg.now ?? Date.now;
    this.periodStart = this.now();
  }

  /** Request graceful stop after the current iteration. */
  stop(): void {
    this.stopped = true;
  }

  /** Run a single observe→decrypt→assess iteration. Useful for tests/dry-runs. */
  async tick(): Promise<TickResult> {
    const { budget, decryptor, engine, observe } = this.cfg;
    const records = await observe(this.cursor);
    budget.recordRpc();

    const flags: Flag[] = [];
    for (const rec of records) {
      const amount = await decryptor.decrypt(rec);
      const decrypted: DecryptedTransfer = {
        signature: rec.signature,
        slot: rec.slot,
        blockTime: rec.blockTime,
        mint: rec.mint,
        source: rec.source,
        destination: rec.destination,
        amount,
      };
      flags.push(...engine.ingest(decrypted));
      this.totalVolume += amount;
      this.cursor = { lastSlot: Math.max(this.cursor.lastSlot, rec.slot), processed: this.cursor.processed + 1 };
      this.sinceReport++;
    }

    this.flagBuffer.push(...flags);
    if (flags.length && this.cfg.onFlags) await this.cfg.onFlags(flags);

    let report: ComplianceReport | undefined;
    if (this.sinceReport >= this.reportEveryN) report = await this.emitReport();
    return { records: records.length, flags, report };
  }

  private async emitReport(): Promise<ComplianceReport> {
    const report = await buildReport(
      {
        mint: this.cfg.mint,
        auditorPubkey: this.cfg.auditorPubkey,
        periodStart: this.periodStart,
        periodEnd: this.now(),
        transfersReviewed: this.cursor.processed,
        totalVolume: this.totalVolume,
        flags: this.flagBuffer,
      },
      this.now(),
    );
    if (this.cfg.onReport) await this.cfg.onReport(report);
    // Reset the reporting period.
    this.flagBuffer = [];
    this.sinceReport = 0;
    this.totalVolume = 0n;
    this.periodStart = this.now();
    return report;
  }

  /** Run until the budget/stop conditions fire, then emit a final report. */
  async run(): Promise<ComplianceReport> {
    const { budget } = this.cfg;
    while (!this.stopped && budget.stopReason(this.now()) === null) {
      budget.recordIteration();
      try {
        const { records } = await this.tick();
        budget.recordSuccess();
        if (records === 0) await this.sleep(this.intervalMs);
      } catch (err) {
        budget.recordError();
        if (this.cfg.onFlags) {
          await this.cfg.onFlags([
            {
              rule: "loop-error",
              severity: "low",
              signature: "-",
              account: this.cfg.mint,
              message: `Iteration error: ${(err as Error).message}`,
            },
          ]);
        }
      }
    }
    return this.emitReport();
  }

  get stopStatus(): string | null {
    return this.cfg.budget.stopReason(this.now());
  }
}
