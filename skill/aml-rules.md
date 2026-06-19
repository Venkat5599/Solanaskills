# AML Rule Engine

The detection logic — and the reason this skill can exist at all. Every rule is a
**pure function** `(RuleContext) → Flag[]` over **decrypted** amounts. These are
exactly the typologies that confidential transfers hide from the public chain, so
**only the auditor-key holder can run them.** That is the moat, in code.

Source: `../lib/src/aml/rules.ts`. Thresholds: `defaultConfig(decimals)` →
`ComplianceConfig`. All amounts are base units (smallest denomination).

## The catalog

| Rule | Sev | Fires when | Why CT hides it | Config |
|---|---|---|---|---|
| `sanctioned` | high | source or dest on the denylist | parties + amounts are encrypted | `sanctioned: Set<string>` |
| `threshold` | high | single transfer ≥ report line (CTR) | the amount is encrypted | `reportThreshold` |
| `structuring` | high | ≥3 sub-threshold outs in window summing ≥ threshold (smurfing) | each piece is on-chain noise | `reportThreshold`, `windowMs` |
| `velocity-volume` | medium | out-volume in window > limit | per-account volume is invisible | `velocityVolumeLimit`, `windowMs` |
| `velocity-count` | medium | out-count in window > limit | per-account flow is invisible | `velocityCountLimit`, `windowMs` |
| `concentration` | medium | one peer ≥ ratio of out-volume (funnel/mule) | the flow graph is obscured | `concentrationRatio`, `concentrationMinEvents` |
| `layering` | medium | out shortly after a ≥-sized in (pass-through) | timing↔amount correlation is hidden | `layeringWindowMs` |
| `dormancy` | medium | idle > N days, then a material transfer | reactivation is invisible | `dormancyMs` |

## Why purity is non-negotiable (CT05)

A rule that reads the clock, hits the network, or rolls a random number produces
findings you cannot reproduce — and an un-reproducible AML finding is worthless to
an examiner. So:

- **Time comes from `transfer.blockTime`,** never `Date.now()`.
- **State comes from the rolling `ComplianceState`,** never a live query.
- **No randomness.** Identical input ⇒ identical flags, forever. (There is a test
  that asserts exactly this.)

This is also what makes the engine fully **unit-testable offline** — feed
synthetic `DecryptedTransfer`s, assert on flags, no crypto or RPC required.

## Tuning

```ts
import { defaultConfig } from "solana-confidential-compliance";

const cfg = defaultConfig(6);
cfg.reportThreshold     = 3_000n * 10n ** 6n;      // tighter CTR line
cfg.windowMs            = 7 * 24 * 3600_000;        // 7-day structuring window
cfg.velocityVolumeLimit = 250_000n * 10n ** 6n;
cfg.concentrationRatio  = 0.85;                     // funnel sensitivity
cfg.sanctioned          = new Set(loadOfacAddresses());
```

| Knob | Raise it to… | Lower it to… |
|---|---|---|
| `reportThreshold` | cut CTR noise (fewer flags) | catch smaller transfers |
| `windowMs` | catch slow structuring | reduce memory + false positives |
| `velocity*Limit` | tolerate busy accounts | tighten on bursty behavior |
| `concentrationRatio` | flag only extreme funnels | flag softer concentration |

## Custom rules

A rule is just a function — add your own typologies and pass a custom ruleset.

```ts
import { defaultRules, ComplianceEngine, type Rule } from "solana-confidential-compliance";

// Flag funds sent to a brand-new account (classic mule onboarding).
const freshAccountRule: Rule = ({ transfer }) =>
  isNewlyCreated(transfer.destination)
    ? [{ rule: "fresh-account", severity: "low", signature: transfer.signature,
         account: transfer.destination, message: "Funds to a brand-new account" }]
    : [];

const engine = new ComplianceEngine(cfg, [...defaultRules, freshAccountRule]);
```

Ideas that fit cleanly: mixer-proximity, round-amount bias, geofenced
counterparties, peel-chain detection, time-of-day anomalies. Keep them pure.

## Testing your rules

Rules are pure ⇒ test them with plain objects. See
`../lib/test/engine.test.ts` — one test per typology, plus a determinism test.
Ship every new rule with a test (CT05); the engine's value to a regulator *is*
its reproducibility.

```ts
const eng = new ComplianceEngine(defaultConfig());
const flags = eng.ingest({ /* synthetic DecryptedTransfer */ });
expect(flags.some(f => f.rule === "structuring")).toBe(true);
```
