---
name: configure-auditor-mint
description: Create a Token-2022 mint with confidential transfers + a global auditor ElGamal key.
---

# /configure-auditor-mint

Issuer-side setup for a regulated confidential-transfer token.

## Steps
1. Load `skill/auditor-key-setup.md`.
2. Generate the auditor ElGamal keypair off-chain; store the **secret** in an
   HSM/TEE. Only the **public** key goes on-chain.
3. Create the mint with `ConfidentialTransferMint` extension:
   - `autoApproveNewAccounts = false` for manual (regulated) approval.
   - pass the auditor **pubkey**.
4. Onboard holders: `configureAccount` → `deposit` → `applyPendingBalance`.
5. Hand the secret-key reference to `/confidential-watch`.

## Guardrails
- Never print, log, or commit the auditor secret key.
- Confirm `decimals` matches what the compliance config expects.
- Prefer manual approval for regulated issuance.
