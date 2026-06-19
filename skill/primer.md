# Primer: Confidential Transfers & the Auditor Key

## What the extension does

`ConfidentialTransfer` is a Token-2022 extension. Token *balances* and *transfer
amounts* are encrypted with **twisted ElGamal**; transactions stay valid via
**zero-knowledge proofs** instead of revealing values:

- **Range proofs** — prove the amount is in `[0, 2^64)` without revealing it.
- **Equality / validity proofs** — prove the ciphertexts under the sender,
  receiver, and auditor keys all encode the same amount.

## The two-balance model

| Balance | Meaning | Who can change it |
|---|---|---|
| **Pending** | Incoming confidential transfers land here | anyone (by sending to you) |
| **Available** | Spendable confidential balance | only you, via `ApplyPendingBalance` |

This split blocks front-running: an attacker spamming you with transfers can't
move your spendable balance.

## Lifecycle (per account)

1. **Configure** — attach an account-specific ElGamal encryption key + AE key.
2. **Deposit** — move public tokens into the confidential **pending** balance.
3. **Apply** — owner merges pending → available.
4. **Transfer** — confidential transfer with ZK proofs (sender/receiver/auditor ciphertexts).
5. **Withdraw** — move confidential balance back to a public balance.

## The auditor key — why this skill exists

A mint can be created with an optional **global auditor ElGamal pubkey**. When
set, every confidential transfer for that mint must include a third ciphertext of
the amount encrypted under the auditor key. The holder of the matching **auditor
secret key** can decrypt *all* transfer amounts for the mint — without touching
any individual account's keys.

That single feature is what lets a regulated issuer offer privacy to its users
*and* satisfy AML/CTF obligations. But the protocol only gives you the key — no
tooling to operate it. This skill is that tooling:

```
confidential transfer (encrypted on-chain)
        │  auditor ciphertext
        ▼
  auditor secret key ──► decrypt amount ──► AML engine ──► hashed report
        └─────────── inside the auditor's trust boundary only ───────────┘
```

## Approval policy

At mint creation the issuer chooses how accounts opt into confidential transfers:

- **auto** — any holder may configure their account permissionlessly.
- **manual** — holders must be approved by the configured authority.

`manual` + auditor key is the typical regulated-issuer posture.

Next: `auditor-key-setup.md` to configure the mint, or `compliance-loop.md` to
run the monitor.
