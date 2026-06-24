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

## Solana's production lo/hi layout (CT09 — implemented + tested)

Solana does **not** encode the on-chain auditor amount as N equal limbs. It
splits the 48-bit transfer amount into a **16-bit low** ElGamal ciphertext and a
**32-bit high** ElGamal ciphertext (each `commitment‖handle`, 64 bytes; 128 bytes
total). That real layout is implemented and round-trip tested offline — decrypt
it by selecting `layout: "lohi"`:

```ts
import { SplAuditorDecryptor, splLoHiCiphertextParser } from "solana-confidential-compliance";

const decryptor = new SplAuditorDecryptor({
  auditorElGamalSecret: auditor.secret,
  layout: "lohi",                              // 16-bit low + 32-bit high
  parseAuditorCiphertext: splLoHiCiphertextParser(), // validates the 128-byte span
});
const amount = await decryptor.decrypt(record); // lo | (hi << 16)
```

The 32-bit high limb needs a one-time discrete-log table (~9s build, ~9k EC ops —
exactly the precomputed table Solana's SDK ships). It is built once in the
decryptor constructor and cached, so per-transfer decryption stays in the tens of
milliseconds (a 10,000-token transfer decrypts in ~50 ms after warm-up). Warm it
ahead with `warmTable(32)` if you want a hot start.

### The only remaining seam

The cryptography and both layouts (`limbed`, `lohi`) are fixed and tested. The
sole thing that can change across `@solana/spl-token` versions is the **byte
framing** around those two ElGamal ciphertexts. `splLoHiCiphertextParser()`
implements the canonical `lo‖hi` span; if a future release reframes it, override
`parseAuditorCiphertext` — the crypto and the AML engine never change. Verify the
framing against the installed version (guardrail **CT09**).

The legacy equal-limb path (`layout: "limbed"`, default) consumes this skill's own
`encryptAmount` output and powers the demo and tests.

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
the `bun run demo` and `bun test` prove, including the real lo/hi layout. When the
program re-enables, the only work is pointing `observe` at live transfers; the
crypto, both ciphertext layouts, and the entire AML pipeline are already done and
tested.
