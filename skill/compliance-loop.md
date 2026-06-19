# The Auditor Compliance Loop

The loop is the product: `observe → decrypt → assess → report → repeat`, running
continuously inside the auditor's trust boundary, with guaranteed termination.

```
        ┌──────────────────────────────────────────────┐
        │                  every tick                   │
        │                                               │
 observe├─► fetch new confidential transfers for mint   │  integration-helius.md
        │      (cursor by slot/signature)               │
 decrypt├─► auditor key decrypts each amount            │  decryption.md
 assess ├─► ComplianceEngine.ingest() → Flag[]          │  aml-rules.md
 report ├─► every N transfers → hashed report           │  reporting.md
        │                                               │
 budget │◄─ stop on iterations / time / RPC / breaker   │  budget-and-stops.md
        └──────────────────────────────────────────────┘
```

## Minimal wiring

```ts
import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, SplAuditorDecryptor,
} from "solana-confidential-compliance";

const engine = new ComplianceEngine(defaultConfig(6)); // 6 decimals
const loop = new ConfidentialComplianceLoop({
  mint, auditorPubkey,
  decryptor: new SplAuditorDecryptor({ auditorElGamalSecret }),
  engine,
  budget: new BudgetLedger({ maxDurationMs: 8 * 3600_000, maxConsecutiveErrors: 5 }),
  observe: fetchNewConfidentialTransfers, // (cursor) => Promise<ConfidentialTransferRecord[]>
  onFlags: async (flags) => { for (const f of flags) await notify(f); },
  onReport: async (r) => { await store.put(r.reportHash, r); },
  intervalMs: 15_000,
  reportEveryN: 500,
});

await loop.run();
```

## Operating model

- **One loop per audited mint.** Each loop only ever decrypts the mint it is
  authorized for. Run separate processes per mint to keep trust boundaries hard.
- **Stateful + restart-safe.** The engine keeps rolling per-account windows in
  memory; persist the cursor (`lastSlot`) so a restart resumes, not re-scans.
- **Backpressure via budget.** `maxConsecutiveErrors` trips the breaker if RPC or
  decryption keeps failing — better to halt and page a human than silently miss.

## Dry-run before going live

Use `MockAuditorDecryptor` (reads amounts from synthetic ciphertext) to replay a
fixture of transfers through the full pipeline with zero crypto and zero network.
The `/confidential-dryrun` command wraps this. See `aml-rules.md` for tuning.
