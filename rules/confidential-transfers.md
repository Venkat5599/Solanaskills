---
name: confidential-transfers-rules
description: Auto-load when working with Token-2022 confidential transfers, ElGamal/auditor keys, or AML/compliance loops.
globs:
  - "**/*confidential*"
  - "**/*elgamal*"
  - "**/*compliance*"
  - "**/*aml*"
  - "**/*auditor*"
---

# Rules: Confidential Transfers & Compliance (CT01–CT08)

These are the non-negotiable guardrails referenced by `skill/SKILL.md` and
enforced by the `auditor-compliance-engineer` agent. Each has a threat model.
Reject — do not "fix later" — any change that violates one.

- **CT01 · Key custody.** Auditor secret key in HSM/TEE, loaded at runtime. Never
  logged, committed, env-dumped, or shipped to a client. Only an
  `AuditorDecryptor` implementation may reference it.
  *Threat: a leaked key decrypts an entire mint's transfer history forever.*

- **CT02 · Trust boundary.** One loop ⇒ one mint ⇒ one key ⇒ one process. No
  shared decryptors across mints.
  *Threat: a loop decrypting an unauthorized mint is unlawful surveillance.*

- **CT03 · No silent skips.** A failed decrypt/observe trips the circuit breaker
  and halts; it never drops a transfer quietly.
  *Threat: a swallowed error lets a flagged transfer pass unseen.*

- **CT04 · Raw amount hygiene.** Decrypted amounts live in memory only long
  enough to score. Persist aggregates + flags via the hashed report flow only —
  never a plaintext ledger of every amount.
  *Threat: persisted plaintext rebuilds the exposure CT exists to prevent.*

- **CT05 · Determinism.** AML rules are pure functions of `(transfer, state,
  config)`. No clock, network, or randomness inside a rule; time comes from
  `transfer.blockTime`. Every new rule ships an offline unit test.
  *Threat: non-deterministic findings are un-auditable and un-reproducible.*

- **CT06 · Termination.** Every continuous loop carries a `BudgetLedger` with at
  least a duration cap and a circuit breaker. No unbounded loops.
  *Threat: a runaway loop burns cost and over-exposes the key.*

- **CT07 · Report immutability.** Reports are SHA-256 hashed over their canonical
  body and append-only. Supersede with a new report; never mutate an emitted one.
  *Threat: a mutated report is tampered evidence.*

- **CT08 · Block ordering.** Process transfers oldest-first; windowed detectors
  depend on it.
  *Threat: out-of-order ingestion corrupts AML windows → false negatives.*

- **CT09 · Version drift.** Verify confidential-transfer calls against the
  installed `@solana/spl-token` version; these helpers change. Don't trust a
  frozen signature.
  *Threat: a stale API silently builds an invalid or unaudited instruction.*
