# solana-confidential

**Author:** Venkat5599
**Repo:** https://github.com/Venkat5599/Solanaskills
**Live demo:** https://solana-confidential-skill.vercel.app
**Version:** 0.1.0
**License:** MIT

## What it does

A progressively loaded Claude Code and Codex skill that turns a coding agent into
the **auditor/compliance side** of Solana Token-2022 Confidential Transfers:
configure a mint's global auditor ElGamal key, then run a continuous loop that
**decrypts only the amounts the auditor is authorized to see**, scores them against
an AML rule engine (structuring, velocity, sanctions, layering, concentration,
dormancy), and emits hashed, tamper-evident compliance reports — with on-chain
privacy intact for everyone else. It is the compliance counterpart to the kit's
confidential-transfer *sending* docs, and delegates transfer construction to
`solana-dev`.

Two things set it apart:

- **Real cryptography, verified against real Solana bytes.** The skill ships a
  working twisted-ElGamal implementation over Ristretto255 (Solana's group) with a
  baby-step-giant-step discrete-log solver. `convention: "solana"` decrypts the
  exact on-chain scheme (`amount·G = C − s·D`), and a test decrypts ciphertext
  produced by the production `@solana/zk-sdk` — byte-identical to on-chain — using
  only this engine's crypto. It also implements Solana's real 16-bit-low +
  32-bit-high amount split (`layout: "lohi"`).
- **Real chain wiring, live on devnet.** An `RpcConfidentialObserver` decodes
  Token-2022 confidential-transfer instructions over real RPC, and
  `readConfidentialMintConfig` parses a mint's on-chain auditor ElGamal key from
  its ConfidentialTransferMint extension. `bun run observe` reads a real devnet
  confidential mint and prints its on-chain auditor key.

## Structure

- `skill/SKILL.md` router plus 9 focused docs (primer, auditor-key setup,
  compliance loop, AML rules, decryption, observation/Helius, reporting,
  budget/stops, resources)
- 1 specialized agent (`auditor-compliance-engineer`), 3 workflow commands
  (`/configure-auditor-mint`, `/confidential-watch`, `/confidential-dryrun`), an
  auto-loading rule set, and `install.sh` / `install-custom.sh`
- A runnable TypeScript core under `lib/`: real twisted-ElGamal + BSGS discrete
  log, Solana-convention decrypt, AML engine, rolling state, budget ledger + circuit
  breaker, hashed reporting, and the compliance loop
- Real on-chain wiring under `lib/src/chain/`: RPC observer + confidential-mint
  config reader
- Runnable examples: `bun run demo` (offline end-to-end encrypt→decrypt→AML→hash)
  and `bun run observe` (live devnet smoke)
- **44 deterministic checks** via `bun test`, `tsc --noEmit` clean, CI on every push

## Problem it solves

Confidential Transfers encrypt amounts on-chain — exactly what institutional,
payroll, B2B, and RWA payments need, and exactly what blocks them, because a
regulator can't see what they're legally required to see. Solana already shipped the
cryptographic answer (a mint can carry a global auditor ElGamal key that decrypts
every transfer amount for that mint), but the protocol gives you only the key — **no
tooling to operate it.** The kit documents how to *send* a confidential transfer;
nobody built the auditor/compliance half. This skill is that half. It unblocks
compliant confidential payments on Solana without de-anonymizing the public chain.

## What makes it strong (mapped to the judging axes)

- **Usefulness:** the full auditor lifecycle — key setup, continuous decryption
  loop, an AML engine over decrypted amounts (the structuring/velocity/layering
  patterns that confidential transfers hide from the public chain, so only the
  auditor key can catch them), SHA-256 hashed reporting, and a budget-bounded loop
  that can't run away.
- **Novelty:** nobody has tooled the confidential-transfer auditor side. Distinct
  from the kit's CT-sending reference and from the seeded crypto-legal skill. The
  hard part — operating the auditor key for genuine compliance — is the moat, and
  it's done and tested.
- **Quality:** real twisted-ElGamal over Ristretto255 with encrypt→decrypt
  round-trips across the full 48-bit range, semantic security, and wrong-key-fails;
  the decrypt path verified against **real `@solana/zk-sdk` ciphertext bytes**; the
  RPC observer and on-chain config reader **live-tested on devnet** (the ZK ElGamal
  Proof program is currently executable on devnet + mainnet). 44 deterministic
  checks, `tsc` clean, CI on every push. Errors as values; eight threat-modeled
  guardrails (CT01–CT08) plus the CT09 ciphertext-layout seam.
- **Fit:** mirrors the reference skill shape (progressive `SKILL.md` router, agents,
  commands, rules, installer, README, MIT), reuses the kit's Helius MCP for
  observation, and sits beside the CT-sending docs as their compliance counterpart.
  Ready to submodule.

## Honesty note

The decrypt path and chain wiring are real and tested; the one thing this repo can't
do in pure JS is *produce* a brand-new confidential transfer — `@solana/spl-token`
ships no confidential-transfer instruction builders (that path is the Rust
`spl-token` CLI). The engine, both ciphertext conventions/layouts, the observer, and
the on-chain auditor-key reader are all real and live-tested; producing a fresh
transfer to decrypt is a one-CLI step outside this skill's scope.

## Install

```bash
git clone https://github.com/Venkat5599/Solanaskills
cd Solanaskills
./install.sh            # → ~/.claude/skills/
```

Run and verify the core offline (no validator, no devnet):

```bash
cd lib && bun install
bun test            # 44 checks: real twisted-ElGamal round-trips, real zk-sdk
                    # vectors, lo/hi layout, AML engine, chain decoding
bun run demo        # end-to-end: encrypt → decrypt → AML flags → hashed report
bunx tsc --noEmit
```

Prove the chain wiring is live (reads a real devnet confidential mint):

```bash
cd lib && bun run observe
```
