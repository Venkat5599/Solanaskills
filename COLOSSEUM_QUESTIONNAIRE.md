# Colosseum Listing — Questionnaire Answers

Paste-ready answers for the Solana AI Kit skill-bounty listing. Copy each answer
into the matching field on the listing.

---

## What does your skill do? (one line)

The auditor-side compliance & AML engine for Solana Token-2022 Confidential
Transfers: configure a mint's global auditor ElGamal key, then run a continuous
loop that decrypts only the amounts you're authorized to see, scores them against
an AML rule engine (structuring, velocity, sanctions, layering, concentration,
dormancy), and emits SHA-256 hashed, tamper-evident compliance reports — with
on-chain privacy intact for everyone else.

## What problem does it solve, and why does it matter to builders?

Confidential Transfers encrypt amounts on-chain. That privacy is exactly what
institutional, payroll, B2B, and RWA payments need — and exactly what blocks them,
because a regulator can't see what they're legally required to see. Solana already
shipped the cryptographic answer: a mint can carry a global auditor ElGamal key
whose holder can decrypt every transfer amount for that mint without touching
anyone's account keys. But the protocol gives you only the key — no tooling to
operate it. The kit documents how to *send* a confidential transfer; nobody built
the auditor/compliance half. This skill is that half. It unblocks compliant
confidential payments on Solana — a whole growth category — without de-anonymizing
the public chain.

## Why is it novel? (the gap it fills)

Existing tooling stops at *sending* confidential transfers. The auditor side — key
setup, real ElGamal decryption, AML detection over decrypted amounts, hashed
reporting, all inside a continuous budget-bounded loop — was unbuilt. It's distinct
from the kit's CT-sending reference and from the seeded crypto-legal skill. The
patterns it detects (structuring, layering, velocity) are precisely the ones
confidential transfers hide from the public chain, so only the auditor key holder
can catch them. That's the moat, and it's done.

## Is it production-grade? How is it tested?

- Real cryptography, not a stub: twisted-ElGamal over Ristretto255 (Solana's group)
  + baby-step-giant-step discrete log. `bun test` proves encrypt→decrypt
  round-trips across the full 48-bit range, ciphertext randomization (semantic
  security), and that the wrong key cannot decrypt.
- Verified against real `@solana/zk-sdk` ciphertext: `convention: "solana"` matches
  Solana's exact scheme (`amount·G = C − s·D`); a test decrypts bytes produced by
  the production library — byte-identical to on-chain — using only this engine's
  crypto. Genuine mainnet-byte compatibility for the decrypt path. Implements
  Solana's real 16-bit-low + 32-bit-high amount split (`layout: "lohi"`).
- Real chain wiring, live-tested on devnet: `RpcConfidentialObserver` decodes
  Token-2022 CT instructions over real RPC; `readConfidentialMintConfig` parses a
  mint's on-chain auditor ElGamal key. `bun run observe` reads a real devnet
  confidential mint and prints its on-chain auditor key. The ZK ElGamal Proof
  program is currently executable on devnet + mainnet.
- 44 deterministic tests, `tsc --noEmit` clean, CI runs install + typecheck + test
  + demo on every push. Eight threat-modeled guardrails (CT01–CT08) + the CT09
  ciphertext-layout seam.
- Runnable end-to-end offline: `bun run demo` encrypts a synthetic transfer stream
  under a fresh auditor key, really decrypts + scores it, and prints flags + a
  hashed report — no network, no mainnet.

## How does it fit the kit?

Mirrors `solana-game-skill`: progressive `skill/SKILL.md` router → 9 focused
modules; `agents/`, `commands/`, `rules/`; `install.sh` / `install-custom.sh`;
README; MIT. Reuses the kit's Helius MCP for observation. Sits beside the CT-sending
docs as their compliance counterpart. Deepens Token-2022. Ready to submodule.

## How do I install / try it?

```bash
git clone https://github.com/Venkat5599/Solanaskills
cd Solanaskills && ./install.sh            # → ~/.claude/skills/
cd lib && bun install && bun test && bun run demo
cd lib && bun run observe                  # live devnet smoke
```

Or try the live demo (no install): https://solana-confidential-skill.vercel.app

## Links

- Skill repo: https://github.com/Venkat5599/Solanaskills
- Bounty PR: https://github.com/solanabr/skill-bounty/pull/26
- Live demo: https://solana-confidential-skill.vercel.app
- License: MIT

## Status / honesty note

The decrypt path is verified against real `@solana/zk-sdk` ciphertext bytes
(byte-identical to on-chain), and the observer + config reader are live-tested on
devnet. The one thing this repo can't do in pure JS is *produce* a brand-new
confidential transfer — `@solana/spl-token` ships no CT instruction builders
(that's the Rust `spl-token` CLI). Everything up to and including decrypting real
Solana ciphertext is done and tested; producing a fresh transfer end-to-end is a
one-CLI step outside the skill's scope.
