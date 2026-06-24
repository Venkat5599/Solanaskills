# Observing Confidential Transfers

The loop needs one function:

```ts
observe: (cursor: LoopCursor) => Promise<ConfidentialTransferRecord[]>
```

It returns confidential transfers for the audited mint that are **newer than the
cursor**, in **block order (oldest first — CT08)**.

## Option A — the shipped `RpcConfidentialObserver` (real chain wiring)

This is real, not pseudocode: `../lib/src/chain/observer.ts` connects to a Solana
RPC, pulls signatures for the watched account, decodes Token-2022 confidential
transfer instructions (outer discriminator `27`, sub-types `Transfer`/`TransferWithSplitProofs`),
and yields records oldest-first. Live-verified on devnet (`bun run observe`).

```ts
import { RpcConfidentialObserver, readConfidentialMintConfig } from "solana-confidential-compliance/chain";
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.RPC_URL!, "confirmed");

// Read the mint's auditor config straight from chain (real TLV parse).
const cfg = await readConfidentialMintConfig(connection, MINT);
//   { authority, autoApproveNewAccounts, auditorElGamalPubkey, ... }

const observer = new RpcConfidentialObserver({
  connection, address: WATCHED_TOKEN_ACCOUNT, mint: MINT,
  extractAuditorCiphertext: (ixData) => /* CT09 span for your spl-token version */ ixData,
});

const loop = new ConfidentialComplianceLoop({ /* … */ observe: (c) => observer.observe(c) });
```

The observer returns transfers oldest-first (CT08) and only past `cursor.lastSlot`.
The one version-dependent seam is pulling the auditor ciphertext out of the
instruction data — supply `extractAuditorCiphertext`, then decrypt with
`layout: "lohi", convention: "solana"` (`decryption.md`).

> **Live example.** `bun run observe` reads a real devnet confidential mint and
> prints its on-chain auditor ElGamal pubkey — e.g. mint
> `9QsnKNvf25R2kwbm5HaspNDroh4gV1Uf8sx7Qt4CyCF2` carries auditor
> `d8e3a866…15625d3f`. Proof the config reader parses genuine on-chain state.

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
