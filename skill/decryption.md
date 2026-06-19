# Auditor Decryption — Real Twisted-ElGamal, Built In

This skill ships a **working** twisted-ElGamal implementation over Ristretto255 —
the same prime-order group Solana's confidential-transfer extension uses. The
auditor secret key really decrypts ciphertext into amounts; the round-trip is
unit-tested across the full 48-bit range. Nothing here is a placeholder.

## The scheme (as implemented in `../lib/src/crypto/`)

```
keypair:  secret scalar s,  public key P = s·H
encrypt(x): random r → ciphertext (C, D)
            C = r·H + x·G     (Pedersen commitment to amount x)
            D = r·P           (decrypt handle)
decrypt:    C − s⁻¹·D = r·H + x·G − s⁻¹·(r·s·H) = x·G
            recover x from x·G by discrete log
```

- `G` — standard Ristretto basepoint (encodes the amount).
- `H` — independent nothing-up-my-sleeve base (hash-to-curve of a fixed domain
  string), so nobody knows `dlog_G(H)`; that gives the commitment its hiding.
- **Limbed amounts.** Amounts are encrypted in 16-bit limbs (3 limbs = 48-bit
  cap, matching Solana). Each limb's discrete log is solved with **baby-step
  giant-step** — a 256-entry table + ≤256 steps per limb. Fast, exact, cached.

| File | Role |
|---|---|
| `crypto/ristretto.ts` | group ops, `G`, `H`, scalars, modular inverse |
| `crypto/twisted-elgamal.ts` | keygen, `encryptAmount`, `decryptAmount`, (de)serialize |
| `crypto/dlog.ts` | baby-step giant-step limb solver |
| `decryptor.ts` | `SplAuditorDecryptor` (real) + `MockAuditorDecryptor` (tests) |

## Using it

```ts
import { generateAuditorKeypair, encryptAmount, SplAuditorDecryptor } from "solana-confidential-compliance";

const auditor = generateAuditorKeypair();          // { secret, pubkey }
// pubkey → goes on the mint;  secret → HSM/TEE, fed to the decryptor:
const decryptor = new SplAuditorDecryptor({ auditorElGamalSecret: auditor.secret });

const amount = await decryptor.decrypt(record);     // bigint, base units
```

## The one version-dependent seam

The cryptography is fixed. The only thing that changes with `@solana/spl-token`
versions is the **wire layout** of the auditor ciphertext inside the on-chain
`ConfidentialTransfer` instruction. Map it to the engine's limb layout with one
adapter — everything else stays put:

```ts
new SplAuditorDecryptor({
  auditorElGamalSecret: auditor.secret,
  parseAuditorCiphertext: (raw) => toLimbBytes(raw), // C0‖D0, C1‖D1, ... (32-byte points)
});
```

Default `parseAuditorCiphertext` is identity — it consumes the output of this
skill's own `encryptAmount` (used by the demo and tests). For **live mainnet
transfers**, implement `toLimbBytes` against the installed zk-sdk auditor-handle
layout. That is the single integration point; verify it against the installed
version (guardrail **CT09**).

## Key handling (CT01/CT02)

- Auditor secret in an **HSM/TEE**, loaded at runtime. Never plaintext config,
  logs, or client bundles. Only an `AuditorDecryptor` may reference it.
- One decryptor ⇒ one mint ⇒ one key. A loop must never decrypt a mint it is not
  authorized for.
- Decrypted amounts are the most sensitive data in the system — in memory only
  long enough to score (CT04).

## Status & localnet

The on-chain ZK ElGamal program is audit-paused on mainnet/devnet (2026), so live
on-chain confidential transfers are temporarily unavailable to *produce*. This
skill's decryption does not depend on that program — it runs today, offline, as
the `bun run demo` and `bun test` prove. When the program re-enables, only the
`parseAuditorCiphertext` adapter needs wiring to real transfers; the crypto and
the entire AML pipeline are already done.
