# solana-confidential-skill

[![CI](https://github.com/Venkat5599/Solanaskills/actions/workflows/ci.yml/badge.svg)](https://github.com/Venkat5599/Solanaskills/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-27%20passing-brightgreen.svg)](#install)
[![crypto](https://img.shields.io/badge/crypto-twisted--ElGamal%20%C2%B7%20Ristretto255-purple.svg)](#real-cryptography-not-a-stub)

**The auditor-side compliance layer for Solana Token-2022 Confidential Transfers.**
Configure a mint's auditor key, then run an autonomous loop that decrypts the
amounts you're authorized to see, applies AML rules, and emits hashed compliance
reports — privacy intact for everyone else.

> Built for the [Solana AI Kit](https://github.com/solanabr/solana-ai-kit).
> MIT licensed, progressive-loading, ready to submodule.

```bash
cd lib && bun install && bun run demo   # watch real ElGamal ciphertext get
                                        # decrypted + scored, end to end
```

**Or chat with it live** — a Claude agent that consumes this skill and runs its real engine
(`demo-app/`): ask it to "run the compliance demo" and watch it generate an auditor key, encrypt a
transfer stream, *actually decrypt it*, and return flags + a hashed report. No install of the skill,
no localnet. See [`demo-app/`](./demo-app).

---

## The problem it solves (ecosystem-level)

Confidential Transfers encrypt amounts on-chain with ElGamal + ZK proofs. That
privacy is exactly what institutional, payroll, B2B, and RWA payments need — and
exactly what blocks them, because regulators can't see amounts. Adoption stalls
on this tension.

Solana already shipped the cryptographic answer: a mint can carry a **global
auditor ElGamal key** whose holder can decrypt every transfer amount for that
mint, without touching anyone's account keys. But the protocol gives you only the
key — **no tooling to operate it.** The kit documents how to *send* a confidential
transfer; nothing handles the auditor/compliance side.

This skill is that missing half. It unblocks confidential payments on Solana by
making them auditable without de-anonymizing the public chain.

## What it does

1. **Issuer setup** — create a Token-2022 mint with confidential transfers + an
   auditor key (`skill/auditor-key-setup.md`).
2. **The compliance loop** — `observe → decrypt → assess → report → repeat`,
   continuous, budget-capped, restart-safe (`skill/compliance-loop.md`).
3. **AML engine** — deterministic, pure-function rules over decrypted amounts:
   sanctions, CTR threshold, **structuring/smurfing**, velocity, counterparty
   concentration, **layering** (pass-through), dormancy (`skill/aml-rules.md`).
   These are the patterns CT hides — only the auditor key can catch them.
4. **Tamper-evident reporting** — SHA-256-hashed, append-only compliance reports
   (`skill/reporting.md`).
5. **Hard termination** — `BudgetLedger` caps iterations/time/RPC + circuit
   breaker (`skill/budget-and-stops.md`).

## Real cryptography, not a stub

The hard part is **done and tested.** `lib/src/crypto/` implements twisted-ElGamal
over **Ristretto255** — the same prime-order group Solana's confidential-transfer
extension uses — with limbed amounts (16-bit × 3 = the 48-bit cap) and a
**baby-step-giant-step** discrete-log solver. The auditor secret key genuinely
decrypts ciphertext into amounts; `bun test` proves the encrypt→decrypt round-trip
across the full 48-bit range, that ciphertext is randomized (semantic security),
and that the **wrong key cannot recover the amount.**

The only version-dependent seam is mapping the on-chain auditor-ciphertext wire
layout into the limb layout — one `parseAuditorCiphertext` adapter
(`skill/decryption.md`). The crypto, AML engine, loop, and reporting are finished.

## Why it fits the kit

- **Novel** — nobody has tooled the CT auditor side. Distinct from the kit's
  CT *sending* reference and from the crypto-legal seed.
- **Useful** — every regulated team that wants confidential payments hits this wall.
- **Cross-domain** — privacy/ZK + compliance + payments + agentic loops.
- **Quality** — `bun test` → 27 passing incl. real-crypto round-trips; `tsc`
  clean; runnable `bun run demo`; CI on every push.
- **Fit** — deepens Token-2022; sits beside the CT sending docs as their
  compliance counterpart; reuses the kit's Helius MCP for observation.

## Install

```bash
./install.sh            # defaults to ~/.claude/skills/
./install-custom.sh     # interactive: location + tests
```

Run the core:

```bash
cd lib && bun install
bun test        # 27 passing (incl. real twisted-ElGamal round-trips)
bun run demo    # end-to-end: encrypt → decrypt → AML flags → hashed report
bunx tsc --noEmit
```

## Quick start

```ts
import {
  ConfidentialComplianceLoop, ComplianceEngine, BudgetLedger,
  defaultConfig, SplAuditorDecryptor,
} from "solana-confidential-compliance";

const loop = new ConfidentialComplianceLoop({
  mint, auditorPubkey,
  decryptor: new SplAuditorDecryptor({ auditorElGamalSecret }), // from your HSM/TEE
  engine: new ComplianceEngine(defaultConfig(6)),
  budget: new BudgetLedger({ maxDurationMs: 8 * 3600_000, maxConsecutiveErrors: 5 }),
  observe: fetchNewConfidentialTransfers, // RPC/Helius — skill/integration-helius.md
  onFlags: alertSink,
  onReport: persistImmutable,
});

await loop.run();
```

Dry-run the whole pipeline with **no crypto, no network** using
`MockAuditorDecryptor` — see `commands/confidential-dryrun.md`.

## Structure

```
solana-confidential-skill/
├── skill/SKILL.md          # progressive router (load modules on demand)
│   ├── primer.md  auditor-key-setup.md  compliance-loop.md
│   ├── aml-rules.md  decryption.md  integration-helius.md
│   ├── reporting.md  budget-and-stops.md  resources.md
├── agents/auditor-compliance-engineer.md
├── commands/               # /confidential-watch /confidential-dryrun /configure-auditor-mint
├── rules/                  # auto-loads on confidential/elgamal/aml/compliance code
├── lib/                    # runnable TS core + tests (bun test → 27 passing)
│   └── src/crypto/         # real twisted-ElGamal + BSGS discrete log
├── examples/demo.ts        # end-to-end runnable demo (bun run demo)
├── demo-app/               # live chat: a Claude agent that runs the skill's engine
├── .github/workflows/ci.yml
├── install.sh  install-custom.sh
└── LICENSE                 # MIT
```

## Status & honesty note

The on-chain ZK ElGamal program is audit-paused on mainnet/devnet (2026), so live
on-chain confidential transfers are temporarily unavailable to *produce*. This
skill's decryption + AML pipeline do **not** depend on that program — they run
today, offline, as `bun run demo` and `bun test` prove. On re-enable, only the
`parseAuditorCiphertext` adapter is wired to real transfers; the crypto and the
whole engine are already finished. See `skill/resources.md` for status links.

## Security posture

This tool makes compliance *possible* without widening surveillance. The auditor
key decrypts only its own mint, inside the auditor's trust boundary; raw amounts
live in memory only long enough to score; reports carry aggregates + flags, not a
plaintext ledger. Protect the auditor secret key in an HSM/TEE. See
`rules/confidential-transfers.md`.

## License

MIT.
