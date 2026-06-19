# Budgets, Stops & the Circuit Breaker

A continuous loop that holds a decryption key and spends RPC must be **provably
terminable**. The `BudgetLedger` (`../lib/src/budget.ts`) is the single source of
truth for "should this loop stop now," checked before every iteration.

## Caps

```ts
new BudgetLedger({
  maxIterations: 10_000,        // hard ceiling on ticks
  maxDurationMs: 8 * 3600_000,  // wall-clock window (e.g. one overnight run)
  maxRpcRequests: 50_000,       // bound RPC spend
  maxConsecutiveErrors: 5,      // circuit breaker
});
```

`stopReason(now)` returns a human-readable reason or `null`. The loop exits the
instant any cap is hit and emits a final report on the way out — so a stop is
always accounted for, never a silent death.

| Cap | Guards against |
|---|---|
| `maxIterations` | a wedged observe/decrypt spinning forever |
| `maxDurationMs` | unbounded runtime; defines a clean run window |
| `maxRpcRequests` | runaway RPC cost on a busy or misconfigured mint |
| `maxConsecutiveErrors` | repeated failures masking missed transfers |

## The circuit breaker (CT03)

Consecutive failed iterations — RPC down, decryptor throwing, `observe` rejecting —
increment a counter; **a success resets it.** Hit `maxConsecutiveErrors` and the
loop halts instead of quietly skipping transfers. You can also force an immediate
stop from an external anomaly detector:

```ts
budget.trip("oracle-divergence detected upstream");   // → loop stops next check
```

## Why this matters *here* specifically

- **Decryption is sensitive and costly.** An unbounded loop hammering decryption
  on a bad mint or a key error should stop, not burn.
- **For compliance, a loud halt beats a quiet gap.** Missing a transfer is worse
  than stopping and paging a human. The breaker encodes that priority.
- **Key exposure is time-bounded.** A run window (`maxDurationMs`) limits how long
  the auditor key is live in a process.

## Graceful stop & overnight cadence

```ts
process.on("SIGTERM", () => loop.stop());   // clean container shutdown
```

`loop.stop()` requests a clean exit after the current iteration and still emits the
final report. Pair `maxDurationMs` with `/loop` or cron: each invocation runs one
bounded window and the next resumes from the persisted cursor
(`integration-helius.md`). Bounded windows + a durable cursor = safe 24/7
operation without a single unbounded loop.

## Inspecting state

```ts
budget.snapshot(); // { iterations, rpcRequests, consecutiveErrors, elapsedMs }
loop.stopStatus;   // current stop reason or null — log it on exit
```
