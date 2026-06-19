# Budgets, Stops & the Circuit Breaker

A continuous loop on a chain must be guaranteed to terminate on demand. The
`BudgetLedger` (`../lib/src/budget.ts`) is the single source of truth for "should
the loop stop now."

## Caps

```ts
new BudgetLedger({
  maxIterations: 10_000,        // hard ceiling on ticks
  maxDurationMs: 8 * 3600_000,  // wall-clock cap (e.g. one overnight run)
  maxRpcRequests: 50_000,       // bound RPC spend
  maxConsecutiveErrors: 5,      // circuit breaker
});
```

`stopReason(now)` returns a human-readable reason or `null`. The loop checks it
before every iteration and exits the instant any cap is hit — emitting a final
report on the way out.

## Circuit breaker

Consecutive failed iterations (RPC down, decryptor throwing, observe rejecting)
increment a counter; a success resets it. Hit `maxConsecutiveErrors` and the loop
halts rather than silently skipping transfers. You can also `budget.trip(reason)`
from an external anomaly detector to force an immediate stop.

## Why this matters here specifically

- **Decryption is sensitive + costly.** An unbounded loop hammering decryption on
  a bad mint or a key error should stop, not spin.
- **Missing transfers is worse than stopping.** For compliance, a halt that pages
  a human beats a loop that quietly drops events it failed to parse.
- **Overnight operation.** Set `maxDurationMs` to your run window; cron/`/loop`
  restarts the next window from the persisted cursor.

## Graceful stop

`loop.stop()` requests a clean exit after the current iteration (and emits the
final report). Wire it to `SIGTERM` for clean container shutdowns.
