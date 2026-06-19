# Observing Confidential Transfers

The loop needs one function:

```ts
observe: (cursor: LoopCursor) => Promise<ConfidentialTransferRecord[]>
```

It returns confidential transfers for the audited mint that are **newer than the
cursor**, in **block order (oldest first — CT08)**. Two ways to build it.

## Option A — poll signatures (any RPC, zero extra infra)

```ts
import { Connection, PublicKey } from "@solana/web3.js";
const connection = new Connection(process.env.RPC_URL!, "confirmed");

async function fetchNewConfidentialTransfers(cursor) {
  const sigs = await connection.getSignaturesForAddress(new PublicKey(MINT), { limit: 1000 });
  const fresh = sigs.filter((s) => (s.slot ?? 0) > cursor.lastSlot).reverse(); // oldest → newest

  const records = [];
  for (const s of fresh) {
    const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    for (const ix of confidentialTransferIxs(tx)) {       // filter Token-2022 CT instructions
      records.push({
        signature: s.signature,
        slot: s.slot,
        blockTime: (tx?.blockTime ?? 0) * 1000,           // ms — AML windows are ms
        mint: MINT,
        source: ix.source,
        destination: ix.destination,
        auditorCiphertext: ix.auditorCiphertext,          // raw bytes → decryptor (CT09 parser)
      });
    }
  }
  return records;
}
```

**Block order matters.** The windowed detectors (structuring, velocity, layering,
dormancy) assume transfers arrive oldest-first. The `.reverse()` above is load-
bearing, not cosmetic.

## Option B — Helius webhooks (push, low latency, high volume)

Register a Helius webhook on the mint / Token-2022 program; feed events into a
queue your `observe` drains each tick. The kit's **Helius MCP** already exposes
enhanced/parsed transactions and webhook management — reuse it instead of
re-deriving instruction parsing.

```
Helius webhook ──► your queue ──► observe() drains (oldest-first) ──► loop
```

Use B when a mint is busy enough that polling misses transfers between ticks or
burns your RPC budget.

## Cursor & restart safety (the part people get wrong)

Persist `cursor.lastSlot` **after each successful tick**.

| If you… | Then on restart… |
|---|---|
| persist the cursor | resume exactly where you stopped ✓ |
| forget to persist | re-scan from 0 → AML windows double-count → false positives |
| advance the cursor before processing | skip a gap → **missed transfers** (worst case for compliance) |

Advance the cursor only for transfers you actually ingested.

## Cost control

Confidential-transfer parsing is read-heavy. The `BudgetLedger.recordRpc()` call
already counts requests; set `maxRpcRequests` as a hard ceiling per run. For
high-volume mints prefer webhooks (B) and cap signature-pull `limit`. See
`budget-and-stops.md`.
