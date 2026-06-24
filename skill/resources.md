# Resources

## Official Solana / Token-2022

- Confidential Transfer extension overview — https://solana.com/docs/tokens/extensions/confidential-transfer
- Confidential Balances (solana-program docs) — https://www.solana-program.com/docs/confidential-balances
- Transfer / Deposit / Withdraw guides — https://solana.com/docs/tokens/extensions/confidential-transfer/transfer-tokens
- SPL confidential-token quickstart — https://spl.solana.com/confidential-token/quickstart
- Kit's existing CT reference (sending) — solana-foundation/solana-dev-skill → `skill/references/confidential-transfers.md`

## SDKs

- `@solana/spl-token` — Token-2022 + confidential-transfer instruction builders
- `@solana/zk-sdk` / `solana-zk-token-sdk` — ElGamal keys, ciphertexts, proofs, DLOG
- `@solana/web3.js` — RPC, transactions

## Guides

- QuickNode: Confidential Transfers developer guide — https://www.quicknode.com/guides/solana-development/spl-tokens/token-2022/confidential
- QuickNode: Confidential Balances are live — https://blog.quicknode.com/confidential-balance-token-extensions-on-solana/

## Status

- ZK ElGamal program is audit-paused on mainnet/devnet (2026). Develop on a local
  validator with the program enabled, or with `MockAuditorDecryptor`. Re-check the
  solana-program docs for the re-enable date before going to mainnet.

## This skill's code

- Crypto: `../lib/src/crypto` — real twisted-ElGamal over Ristretto255
  (`@noble/curves`), baby-step-giant-step discrete log, the canonical
  `commitment||handle` parser, and Solana's lo(16)/hi(32) production layout.
- Engine + loop: `../lib/src` — pure AML engine, state, budgets, reporting, loop.
- Tests: `../lib/test` — `bun test` (**34 passing**), incl. encrypt→decrypt
  round-trips, semantic security, wrong-key-fails, parser round-trip, and the
  real lo/hi layout. `tsc` clean.
- Demo: `../examples/demo.ts` — `bun run demo`, full pipeline, no network.
- CI: `.github/workflows/ci.yml` — install + typecheck + test + demo on every push.

## Crypto references

- Ristretto255 — https://ristretto.group
- Twisted ElGamal / Solana zk-token-sdk (group, ciphertext layout) — see
  solana-program confidential-balances docs above.
- @noble/curves — https://github.com/paulmillr/noble-curves
