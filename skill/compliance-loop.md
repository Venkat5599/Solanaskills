# The Auditor Compliance Loop

The loop is the product. Everything else — keys, crypto, rules, reports — exists
to feed this cycle: **observe → decrypt → assess → report → repeat**, running
continuously inside the auditor's trust boundary, with termination guaranteed.

## The cycle

```
        ┌──────────────────────────── every tick ───────────────────────────┐
        │                                                                    │
 OBSERVE│  fetch confidential transfers newer than the cursor, oldest-first  │ integration-helius.md
        │     │  (RPC poll or Helius webhook queue)                          │
 DECRYPT│     ▼  auditor secret key → real amount per transfer (CT01/CT02)   │ decryption.md
 ASSESS │     ▼  ComplianceEngine.ingest() → Flag[]   (pure, deterministic)  │ aml-rules.md
 REPORT │     ▼  every N transfers + at shutdown → SHA-256 hashed report     │ reporting.md
        │                                                                    │
 BUDGET │◄──── stop on iterations / time / RPC / consecutive-errors ─────────│ budget-and-stops.md
        └────────────────────────────────────────────────────────────────────┘
```

## Minimal wiring

```ts
import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, SplAuditorDecryptor, splAuditorCiphertextParser, DEFAULT_LIMBS,
} from "solana-confidential-compliance";

const cfg = defaultConfig(6);                 // 6-decimal mint
cfg.sanctioned = new Set(loadOfacAddresses());

const loop = new ConfidentialComplianceLoop({
  mint, auditorPubkey,
  decryptor: new SplAuditorDecryptor({
    auditorElGamalSecret,                      // from HSM/TEE — CT01
    parseAuditorCiphertext: splAuditorCiphertextParser(DEFAULT_LIMBS.limbs), // CT09
  }),
  engine: new ComplianceEngine(cfg),
  budget: new BudgetLedger({ maxDurationMs: 8 * 3600_000, maxConsecutiveErrors: 5 }), // CT06
  observe: fetchNewConfidentialTransfers,      // (cursor) => Promise<Record[]>, oldest-first — CT08
  onFlags: async (flags) => { for (const f of flags) await route(f); },
  onReport: async (r) => store.putImmutable(r.reportHash, r),  // CT07
  intervalMs: 15_000,
  reportEveryN: 500,
});

await loop.run();   // returns the final hashed report when a stop condition fires
```

## Two ways to drive it

| Method | Use for |
|---|---|
| `loop.run()` | production: loops until a budget/stop condition, emits a final report |
| `loop.tick()` | tests, dry-runs, or driving from an external scheduler (`/loop`, cron) — one observe→decrypt→assess pass, returns `{ records, flags, report? }` |

## Operating model (the non-obvious parts)

- **One loop ⇒ one mint ⇒ one key ⇒ one process (CT02).** Never share a decryptor
  across mints. Separate processes keep trust boundaries physically hard, not just
  logically.
- **Stateful but restart-safe.** The engine keeps rolling per-account windows in
  memory; the loop keeps a `cursor.lastSlot`. **Persist the cursor** after each
  tick — on restart you resume, you do not re-scan (double-counts AML windows) and
  you do not skip (misses transfers).
- **Backpressure is the budget.** `maxConsecutiveErrors` trips the breaker when
  RPC or decryption keeps failing. The loop halts and pages a human rather than
  silently dropping transfers (CT03). For compliance, a loud stop beats a quiet gap.
- **Reporting cadence is independent of detection.** Flags fire per-transfer (route
  high-severity ones to a human immediately); reports roll up every `reportEveryN`
  and at shutdown.

## Long-running / overnight operation

Set `maxDurationMs` to your run window and let `/loop` or cron restart the next
window from the persisted cursor. Wire `loop.stop()` to `SIGTERM` for a clean
container shutdown that still emits a final report.

```bash
# one bounded window per invocation; restart resumes from the cursor
bun run watch-mint.ts   # constructs the loop, run(), persists cursor on exit
```

## Prove it before mainnet

Drive the **entire** pipeline with `MockAuditorDecryptor` (or the real one against
synthetic ciphertext) — no network, no key custody. `bun run demo` does exactly
this end-to-end; `/confidential-dryrun` wraps it for your own fixtures. Tune in
`aml-rules.md`, then point `observe` at live transfers.
