# Submission — solana-confidential-skill

**Repo:** https://github.com/Venkat5599/Solanaskills
**License:** MIT · **CI:** passing · **Tests:** 44 passing · **Demo:** `cd lib && bun run demo`

Draft answers for the Colosseum listing questionnaire. Edit to taste before filing.

---

### What does your skill do? (one line)
The auditor-side compliance & AML engine for Solana Token-2022 Confidential
Transfers: configure a mint's auditor key, then run a continuous loop that
decrypts only the amounts you're authorized to see, scores them against an AML
rule engine, and emits hashed, tamper-evident compliance reports — privacy intact
for everyone else.

### What problem does it solve, and why does it matter to builders?
Confidential Transfers encrypt amounts on-chain. That privacy is what
institutional, payroll, B2B, and RWA payments need — and exactly what blocks them,
because a regulator can't see what they're legally required to see. Solana already
shipped the cryptographic answer: a mint can carry a **global auditor ElGamal key**
whose holder can decrypt every transfer amount for that mint without touching
anyone's account keys. But the protocol gives you only the key — **no tooling to
operate it.** The kit documents how to *send* a confidential transfer; nobody had
built the auditor/compliance half. This skill is that half. It unblocks compliant
confidential payments on Solana — a whole growth category — without de-anonymizing
the public chain.

### Why is it novel? (the gap it fills)
Existing tooling stops at *sending* confidential transfers. The auditor side —
key setup, real ElGamal decryption, AML detection over decrypted amounts, hashed
reporting, all inside a continuous loop — was unbuilt. It's distinct from the
kit's CT-sending reference and from the seeded crypto-legal skill. The hard part
(operating the auditor key for genuine compliance) is the moat, and it's done.

### Is it production-grade? How is it tested?
- **Real cryptography, not a stub.** `lib/src/crypto/` implements twisted-ElGamal
  over Ristretto255 (Solana's group) + baby-step-giant-step discrete log. `bun
  test` proves encrypt→decrypt round-trips across the full 48-bit range, ciphertext
  randomization (semantic security), and that the **wrong key cannot decrypt**.
- **Verified against REAL `@solana/zk-sdk` ciphertext.** `convention: "solana"`
  matches Solana's exact scheme (`amount·G = C − s·D`); `test/solana-vectors.test.ts`
  decrypts bytes produced by the production library — byte-identical to on-chain —
  and recovers the exact amount, using only this engine's crypto (no zk-sdk at test
  or run time). This is genuine mainnet-byte compatibility for the decrypt path.
- **44 tests passing**, `tsc --noEmit` clean, CI runs install + typecheck + test +
  demo on every push.
- **Runnable end-to-end:** `bun run demo` encrypts a synthetic transfer stream
  under a fresh auditor key, then really decrypts + scores it, printing flags and a
  hashed report — no network, no mainnet.
- **Solana's real amount layout is implemented**, not just the demo's equal limbs:
  the 16-bit-low + 32-bit-high ElGamal split (`layout: "lohi"` +
  `splLoHiCiphertextParser()`) decrypts the actual 128-byte on-chain framing,
  round-trip tested offline. The 32-bit high limb uses a one-time precomputed
  discrete-log table (Solana ships the same); per-transfer decrypts run in ms.
  Documented as CT09.

### How does it fit the kit? (structure)
Mirrors `solana-game-skill`: progressive `skill/SKILL.md` router → 9 focused
modules; `agents/`, `commands/`, `rules/`; `install.sh` / `install-custom.sh`;
README; MIT. Reuses the kit's Helius MCP for observation. Sits beside the CT
sending docs as their compliance counterpart. Deepens Token-2022.

### How do I install / try it?
```bash
git clone https://github.com/Venkat5599/Solanaskills
cd Solanaskills && ./install.sh            # → ~/.claude/skills/
cd lib && bun install && bun test && bun run demo
```

- **Real chain wiring, live-tested on devnet.** `lib/src/chain/` ships an
  `RpcConfidentialObserver` (decodes Token-2022 CT instructions over real RPC) and
  `readConfidentialMintConfig` (parses a mint's ConfidentialTransferMint extension
  from chain). `bun run observe` reads a real devnet confidential mint and prints
  its on-chain auditor ElGamal pubkey. The ZK ElGamal Proof program is currently
  `executable` on devnet + mainnet.
- **The chat demo can't hard-fail.** If the LLM gateway is unreachable, the API
  runs the skill's real engine locally and returns genuine flags + a report hash.

### Status / honesty note
The decrypt path is verified against **real `@solana/zk-sdk` ciphertext bytes**
(byte-identical to on-chain), and the observer + config reader are **live-tested on
devnet**. The one thing this repo can't do in pure JS is *produce* a new
confidential transfer — `@solana/spl-token` ships no CT instruction builders (that's
the Rust `spl-token` CLI). Everything up to and including decrypting real Solana
ciphertext is done and tested; producing a fresh transfer end-to-end is a one-CLI
step outside the skill's scope.
