# Primer — Confidential Transfers & the Auditor Key

*Read this once. It is the conceptual foundation every other module assumes.*

## The tension this whole skill resolves

A public ledger and a regulated financial flow want opposite things. The ledger
wants every amount verifiable; the regulator's counterparties want their salaries,
invoices, and treasury moves *not* broadcast to competitors. For years that
tension meant "either public or off-chain." Confidential Transfers dissolve it:
amounts are **encrypted on-chain**, yet still **provably valid**, and a single
authorized party — and no one else — can read them.

This skill operates that authorized party's side. Get the model below and the
rest of the skill is mechanical.

## How the extension works

`ConfidentialTransfer` is a Token-2022 extension. Balances and transfer amounts
are encrypted with **twisted ElGamal** over Ristretto255; validity is preserved
by **zero-knowledge proofs** rather than by revealing values:

| Proof | Guarantees | Without revealing |
|---|---|---|
| **Range proof** | amount ∈ [0, 2⁴⁸) — no overflow, no negative | the amount |
| **Equality / validity** | sender, receiver, and auditor ciphertexts encode the *same* amount | the amount |

Encryption is **homomorphic** in the limited, deliberate way the scheme needs:
ciphertexts add, so a balance can be updated without ever being decrypted on-chain.

## The two-balance model (and why it exists)

| Balance | Meaning | Who can change it |
|---|---|---|
| **Pending** | where incoming transfers land | anyone, by sending to you |
| **Available** | what you can actually spend | only you, via `ApplyPendingBalance` |

The split is a **front-running defense**: an attacker spamming you with transfers
churns only your *pending* balance and can never disturb a transaction you build
against *available*. Remember this — it is why the lifecycle has an "apply" step
that looks redundant but isn't.

## Lifecycle (per account)

```
configure ──► deposit ──► apply ──► transfer ──► withdraw
   set ECK     public→     pending    ZK proofs +    confidential→
   + AE key    pending     →available  3 ciphertexts  public
```

1. **Configure** — attach the account's ElGamal encryption key (ECK) + AES key.
2. **Deposit** — move public tokens into the confidential *pending* balance.
3. **Apply** — owner merges pending → available (the front-running gate).
4. **Transfer** — confidential transfer; emits sender/receiver/**auditor** ciphertexts + proofs.
5. **Withdraw** — confidential balance back to a public balance.

## The auditor key — why this skill exists

A mint may be created with an optional **global auditor ElGamal public key**.
Once set, **every** confidential transfer for that mint must include a third
ciphertext of the amount under the auditor key. The holder of the matching
**auditor secret key** can decrypt *all* transfer amounts for that mint —
**without touching any individual account's keys.**

```
   confidential transfer on-chain
   ┌───────────────┬───────────────┬──────────────────┐
   │ sender cipher │ receiver cipher│  AUDITOR cipher   │ + ZK proofs
   └───────────────┴───────────────┴────────┬─────────┘
                                             │ auditor secret key
                                             ▼
                                   amount (plaintext, base units)
                                             │
                                             ▼  inside the auditor boundary only
                                       AML engine → hashed report
```

That one feature is the entire basis for *compliant privacy*: a regulated issuer
offers users genuine confidentiality **and** can satisfy AML/CTF obligations. The
protocol ships the key and nothing else — this skill is the "nothing else."

## Approval policy (a design decision you make once)

At mint creation the issuer picks how holders opt in:

- **auto** (`autoApproveNewAccounts = true`) — permissionless; any holder configures their own account.
- **manual** (`false`) — holders must be approved by the configured authority.

`manual` + auditor key is the standard **regulated-issuer** posture: you choose
who transacts, and you can audit what they move.

## Where to go next

- Issuer building a mint → `auditor-key-setup.md`
- Operating the monitor → `compliance-loop.md`
- The detection logic → `aml-rules.md`
- The cryptography itself → `decryption.md`
