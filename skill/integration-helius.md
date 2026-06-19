# Observing Confidential Transfers (RPC / Helius)

The loop needs an `observe(cursor) => Promise<ConfidentialTransferRecord[]>` that
returns confidential transfers newer than the cursor for the audited mint.

## Option A — poll signatures (any RPC)

```ts
import { Connection, PublicKey } from "@solana/web3.js";
const connection = new Connection(process.env.RPC_URL!);

async function fetchNewConfidentialTransfers(cursor) {
  // Pull recent signatures touching the mint (or a tracked program/account set),
  // then fetch parsed txs and keep only confidential-transfer instructions.
  const sigs = await connection.getSignaturesForAddress(new PublicKey(MINT), { limit: 1000 });
  const fresh = sigs.filter((s) => (s.slot ?? 0) > cursor.lastSlot);
  const records = [];
  for (const s of fresh.reverse()) {              // oldest → newest (block order matters)
    const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    for (const ix of confidentialTransferIxs(tx)) {
      records.push({
        signature: s.signature, slot: s.slot, blockTime: (tx?.blockTime ?? 0) * 1000,
        mint: MINT, source: ix.source, destination: ix.destination,
        auditorCiphertext: ix.auditorCiphertext,  // raw bytes for the decryptor
      });
    }
  }
  return records;
}
```

Block order matters: the AML windows assume transfers arrive oldest-first.

## Option B — Helius webhooks (push, lower latency)

Register a Helius webhook on the mint / Token-2022 program and feed events into a
queue your `observe` drains. Helius parsed transactions and enhanced webhooks are
in the kit's Helius MCP — reuse them rather than re-deriving parsing.

## Cursor & restart safety

Persist `cursor.lastSlot` after each tick. On restart, resume from it so you
never re-scan or, worse, skip a gap. The `BudgetLedger.recordRpc()` call already
counts requests so you can cap RPC spend per run.

## Cost note

Confidential-transfer parsing is read-heavy. Use a window/limit on signature
pulls and lean on webhooks for high-volume mints. `maxRpcRequests` in the budget
is your hard ceiling.
