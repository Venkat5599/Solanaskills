---
name: solana-confidential
description: >-
  The auditor-side compliance & AML engine for Solana Token-2022 Confidential
  Transfers. Configure a mint's global auditor ElGamal key, then run a
  continuous loop that decrypts only the amounts you are authorized to see,
  scores them against an AML rule engine (structuring, velocity, sanctions,
  layering, dormancy), and emits hashed, tamper-evident compliance reports —
  with on-chain privacy intact for everyone else. Use when building confidential
  payments, payroll, treasury, B2B, or RWA flows on Solana that must satisfy a
  regulator without de-anonymizing the public chain.
user-invocable: true
license: MIT
compatibility:
  - "@solana/web3.js >=1.95"
  - "@solana/spl-token >=0.4.9 (Token-2022 confidential transfer)"
  - "bun >=1.1 (test + run)"
metadata:
  author: solana-confidential-skill contributors
  version: 0.1.0
  domain: privacy · compliance · payments · agentic-loops
---

# Solana Confidential Transfers — Compliance & Audit Engine

> Confidential Transfers gave Solana on-chain privacy. They also gave it a
> compliance blind spot. This skill is the missing key that opens it — *only*
> for the one who is authorized to hold it.

The Token-2022 confidential-transfer extension encrypts amounts on-chain with
twisted-ElGamal + zero-knowledge proofs. Brilliant for payroll, treasury, B2B,
and RWA — and exactly what stalls their adoption, because a regulator cannot see
what they are legally required to see. Solana already shipped the cryptographic
answer: a mint can carry a **global auditor ElGamal key** whose holder can
decrypt every transfer amount for that mint without touching any account's keys.

The protocol gives you the key and nothing else. **This skill is everything
else.** The kit already documents how to *send* a confidential transfer; this is
the auditor half nobody has built: key setup → continuous decryption loop → AML
engine → hashed reports. Deterministic, testable, key-safe, and forward-fit for
the moment the ZK program re-enables.

---

## What this skill is for

Activate when the user says any of:

- "audit / monitor confidential transfers", "AML for Token-2022", "compliance for
  confidential balances"
- "set up the auditor key", "decrypt confidential transfer amounts", "global
  auditor ElGamal key"
- "detect structuring / smurfing / layering on confidential transfers"
- "confidential payroll / treasury / RWA but we need to satisfy a regulator"
- "generate a compliance report for a confidential mint"

Do **not** use this skill to *send* confidential transfers, configure a holder's
own account for spending, or build the ZK proofs for a transfer — that is the
sender side (kit's `solana-dev-skill → references/confidential-transfers.md`).
This skill owns the **auditor / issuer-compliance** side only.

## Opinionated defaults

| Decision | Default | Why / when to deviate |
|---|---|---|
| Token program | **Token-2022** | Confidential transfers are a Token-2022 extension. No alternative. |
| Approval policy | **manual** (`autoApproveNewAccounts = false`) | Regulated issuance. Use `auto` only for permissionless/experimental mints. |
| Decryption | behind the **`AuditorDecryptor`** interface | Keeps the audit-paused ZK program out of the engine; swap `Mock`→`Spl` with zero engine changes. |
| Key custody | **HSM / TEE**, provisioned at runtime | Never plaintext config. No exceptions for "just dev" — dev keys leak to prod. |
| Loop control | **always** a `BudgetLedger` | No unbounded loops on a chain. Ever. |
| Runtime / tests | **bun** | `bun test`, `bunx tsc`. Never npm. |
| Report integrity | **SHA-256 hashed, append-only** | Reports are evidence. Supersede, never mutate. |

## The 30-second mental model

```
        PUBLIC CHAIN                         AUDITOR TRUST BOUNDARY (this skill)
 ┌───────────────────────────┐      ┌──────────────────────────────────────────────┐
 │ confidential transfer      │      │  observe ─► decrypt ─► assess ─► report ─► ↻  │
 │ amount = ENCRYPTED         │      │    │         │          │          │          │
 │ (sender|receiver|AUDITOR)  │──────┼──► │   auditor secret    AML       hashed     │
 │ ZK-proven, public sees ∅   │ auditor│  RPC/    key decrypts  rule       tamper-    │
 └───────────────────────────┘ cipher │  Helius   the amount   engine     evident    │
   privacy preserved for all          │          (ElGamal+DLOG)  ▲         report     │
   non-auditors, always               │                     budget + breaker          │
                                      └──────────────────────────────────────────────┘
   Only the auditor key holder, for one mint, inside this boundary, can see amounts.
```

## Operating procedure

**Step 1 — classify the task:**

| The user wants to… | Mode | Start at |
|---|---|---|
| Stand up a regulated confidential token | **Issuer setup** | `auditor-key-setup.md` |
| Run continuous AML monitoring | **Operate loop** | `compliance-loop.md` |
| Tune detection / add a rule | **Tune** | `aml-rules.md` |
| Connect real decryption | **Wire crypto** | `decryption.md` |
| Pull transfers to watch | **Observe** | `integration-helius.md` |
| Produce a regulator-facing report | **Report** | `reporting.md` |
| Test coverage before mainnet | **Dry-run** | `commands/confidential-dryrun.md` |

**Step 2 — pick the agent:** delegate build/operate work to
`agents/auditor-compliance-engineer.md` (enforces every guardrail below).

**Step 3 — apply the guardrails** (next section) — they are non-negotiable.

## Safety guardrails (non-negotiable, threat-modeled)

Each guardrail has an ID, a threat, and a mandate. The agent and the auto-loaded
`rules/confidential-transfers.md` reject any change that violates one.

| ID | Threat | Mandate |
|---|---|---|
| **CT01 · Key custody** | Auditor secret key leaks → attacker decrypts an entire mint's history | Secret key lives in HSM/TEE, loaded at runtime. Never logged, committed, or in client code. Only an `AuditorDecryptor` may reference it. |
| **CT02 · Trust boundary** | A loop decrypts a mint it isn't authorized for → unlawful surveillance | One loop ⇒ one mint ⇒ one key, one process. No shared decryptors. |
| **CT03 · No silent skips** | A failed decrypt/observe is swallowed → a flagged transfer goes unseen | Errors increment the circuit breaker and halt. Missing a transfer is worse than stopping. |
| **CT04 · Raw amount hygiene** | Decrypted amounts persisted → you rebuilt the plaintext ledger CT was meant to prevent | Raw amounts live in memory only long enough to score. Persist aggregates + flags via the hashed report flow only. |
| **CT05 · Determinism** | Non-deterministic rules → un-auditable, un-reproducible findings | AML rules are pure functions of `(decrypted transfer, rolling state, config)`. No clock/IO/randomness inside a rule; time comes from `transfer.blockTime`. Every rule ships an offline test. |
| **CT06 · Termination** | Unbounded loop → runaway cost, key over-exposure | Every loop carries a `BudgetLedger` with at least a duration cap + breaker. |
| **CT07 · Report immutability** | Mutated reports → tampered evidence | Reports are SHA-256 hashed over canonical body; append-only. Supersede, never edit. |
| **CT08 · Block ordering** | Out-of-order ingestion → wrong AML windows → false negatives | Process transfers oldest-first; the windowed detectors depend on it. |

## AML rule taxonomy (the crown jewel)

These are precisely the patterns confidential transfers hide from the public
chain — so **only the auditor key holder can detect them.** That is the moat.
Defined in `../lib/src/aml/rules.ts`; tuned via `defaultConfig(decimals)`.

| Rule | Sev | Catches | Hidden by CT because… |
|---|---|---|---|
| `sanctioned` | high | OFAC / denylisted counterparty | amounts + flows are encrypted |
| `threshold` | high | single transfer ≥ CTR line | amount is encrypted |
| `structuring` | high | a big payment split into sub-threshold pieces (smurfing) | each piece looks like noise on-chain |
| `velocity-volume` / `velocity-count` | medium | bursts beyond a per-window limit | per-account volume is invisible |
| `concentration` | medium | funnel/mule — most volume to one peer | flow graph is obscured |
| `layering` | medium | rapid in-then-out pass-through | timing+amount correlation is hidden |
| `dormancy` | medium | long-idle account suddenly moves material funds | reactivation is invisible |

Extend with custom pure-function rules (`aml-rules.md`) — `freshAccount`, mixer
proximity, geofencing, your own typologies.

## End-to-end (the whole thing, in one screen)

```ts
import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, SplAuditorDecryptor,
} from "solana-confidential-compliance";

// 1. Engine: deterministic AML over decrypted amounts (6-decimal mint).
const cfg = defaultConfig(6);
cfg.sanctioned = new Set(loadOfacAddresses());      // your screening list
const engine = new ComplianceEngine(cfg);            // + custom rules optional

// 2. Loop: observe → decrypt → assess → report → repeat, guaranteed to stop.
const loop = new ConfidentialComplianceLoop({
  mint, auditorPubkey,
  decryptor: new SplAuditorDecryptor({ auditorElGamalSecret }), // HSM/TEE — CT01
  engine,
  budget: new BudgetLedger({ maxDurationMs: 8 * 3600_000, maxConsecutiveErrors: 5 }), // CT06
  observe: fetchNewConfidentialTransfers,            // RPC/Helius, oldest-first — CT08
  onFlags: async (f) => { for (const x of f) await page(x); },  // high-sev → human
  onReport: async (r) => store.putImmutable(r.reportHash, r),   // append-only — CT07
});

await loop.run();   // halts on budget/breaker, emits a final hashed report
```

Dry-run the **entire** pipeline with no crypto and no network using
`MockAuditorDecryptor` — see `commands/confidential-dryrun.md`.

## Progressive disclosure (read only when needed)

| Module | Load when you need to… |
|---|---|
| `primer.md` | understand CT + the auditor key from first principles |
| `auditor-key-setup.md` | create a mint with confidential transfers + an auditor key |
| `compliance-loop.md` | architect & operate the monitoring loop |
| `aml-rules.md` | tune thresholds, add custom detection rules |
| `decryption.md` | wire real ElGamal + discrete-log decryption |
| `integration-helius.md` | fetch confidential transfers (poll or webhook) |
| `reporting.md` | emit hashed, regulator-facing reports |
| `budget-and-stops.md` | guarantee termination + circuit breaking |
| `resources.md` | official specs, SDKs, status, links |

## Commands & agents

| Invoke | Does |
|---|---|
| `/configure-auditor-mint` | issuer setup: mint + auditor key |
| `/confidential-watch` | start the live compliance loop for a mint |
| `/confidential-dryrun` | replay a fixture through the full AML pipeline, offline |
| agent `auditor-compliance-engineer` | builds/operates the layer; enforces CT01–CT08 |

## Runnable core

`../lib` — TypeScript core. AML engine, rolling state, budget, reporting, loop,
**and real twisted-ElGamal decryption** (Ristretto255 + baby-step-giant-step
discrete log, via `@noble/curves`). `cd lib && bun test` → **34 passing**
(incl. encrypt→decrypt round-trips across the full 48-bit range, semantic
security, wrong-key-fails, and Solana's real lo/hi amount layout), `bunx tsc
--noEmit` → **clean**.

See it run end-to-end with zero network and zero mainnet:

```bash
cd lib && bun run demo   # encrypts a synthetic transfer stream under a fresh
                         # auditor key, then REALLY decrypts + scores it, prints
                         # flags + a hashed report
```

The crypto is fixed and done. Both amount layouts are implemented and tested: the
engine's equal-limb format **and Solana's real 16-bit-low + 32-bit-high split**
(`layout: "lohi"` + `splLoHiCiphertextParser()`, CT09). The only remaining seam is
the byte framing around the two on-chain ciphertexts if a future `@solana/spl-token`
release changes it — `parseAuditorCiphertext` overrides it. See `decryption.md`.

> **Status (2026):** the on-chain ZK ElGamal program is audit-paused, so live
> on-chain confidential transfers are temporarily unavailable to *produce*. This
> skill's decryption + AML pipeline do **not** depend on that program — they run
> today (`bun run demo`, `bun test`), including the real lo/hi layout. On
> re-enable, the only work is pointing `observe` at live transfers; the crypto,
> both ciphertext layouts, and the whole engine are already finished. Deliberately
> forward-fit for the institutional confidential-payments wave it unlocks.

## Prime directive

This tool exists to make compliance **possible without widening surveillance.**
The auditor key decrypts one mint, inside one boundary, for one lawful purpose.
Privacy is the default for everyone else — by cryptography, not by policy. Hold
that line in every change.
