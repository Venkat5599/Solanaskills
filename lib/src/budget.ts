/**
 * Loop budget / stop conditions. A continuous compliance loop must be
 * guaranteed to terminate on demand — caps on iterations, wall-clock time, and
 * RPC requests, plus a circuit breaker on consecutive errors.
 */
export interface BudgetConfig {
  maxIterations?: number;
  maxDurationMs?: number;
  maxRpcRequests?: number;
  /** Trip the breaker after this many consecutive failed iterations. */
  maxConsecutiveErrors?: number;
}

export class BudgetLedger {
  private iterations = 0;
  private rpcRequests = 0;
  private consecutiveErrors = 0;
  private readonly startedAt = Date.now();
  private trippedReason: string | null = null;

  constructor(private readonly cfg: BudgetConfig) {}

  recordIteration(): void {
    this.iterations++;
  }
  recordRpc(n = 1): void {
    this.rpcRequests += n;
  }
  recordSuccess(): void {
    this.consecutiveErrors = 0;
  }
  recordError(): void {
    this.consecutiveErrors++;
  }
  trip(reason: string): void {
    this.trippedReason = reason;
  }

  /** Reason the loop must stop, or null to continue. */
  stopReason(now: number = Date.now()): string | null {
    if (this.trippedReason) return `circuit-breaker: ${this.trippedReason}`;
    const c = this.cfg;
    if (c.maxConsecutiveErrors !== undefined && this.consecutiveErrors >= c.maxConsecutiveErrors)
      return `consecutive-errors >= ${c.maxConsecutiveErrors}`;
    if (c.maxIterations !== undefined && this.iterations >= c.maxIterations)
      return `iterations >= ${c.maxIterations}`;
    if (c.maxRpcRequests !== undefined && this.rpcRequests >= c.maxRpcRequests)
      return `rpc-requests >= ${c.maxRpcRequests}`;
    if (c.maxDurationMs !== undefined && now - this.startedAt >= c.maxDurationMs)
      return `duration >= ${c.maxDurationMs}ms`;
    return null;
  }

  snapshot() {
    return {
      iterations: this.iterations,
      rpcRequests: this.rpcRequests,
      consecutiveErrors: this.consecutiveErrors,
      elapsedMs: Date.now() - this.startedAt,
    };
  }
}
