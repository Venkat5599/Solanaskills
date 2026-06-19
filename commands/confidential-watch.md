---
name: confidential-watch
description: Start the auditor compliance monitoring loop for a confidential-transfer mint.
---

# /confidential-watch

Stand up and run `ConfidentialComplianceLoop` for a given mint.

## Inputs
- `MINT` — the Token-2022 mint to audit (must have an auditor key).
- `AUDITOR_KEY_REF` — HSM/TEE reference for the auditor ElGamal secret key.
- `RPC_URL` / Helius webhook config — how to observe transfers.

## Steps
1. Load `skill/compliance-loop.md` and `skill/integration-helius.md`.
2. Build `observe()` for the mint (poll signatures or drain the Helius queue).
3. Construct `SplAuditorDecryptor` from the HSM key ref (never inline the key).
4. Construct `ComplianceEngine(defaultConfig(decimals))`; apply the tuned
   thresholds + sanctions list from policy.
5. Construct `BudgetLedger` with run-window caps + circuit breaker.
6. Wire `onFlags` → alert sink (page on high severity), `onReport` → immutable
   store keyed by `reportHash`.
7. `await loop.run()`. Persist `cursor.lastSlot` for restart safety.

## Guardrails
- Refuse to start without a budget (no unbounded loops).
- Refuse to start if the key would be read from plaintext config.
- One mint per process.
