# AML Rule Catalog

Every rule is a pure function `(RuleContext) -> Flag[]` over **decrypted**
amounts. These are exactly the patterns confidential transfers hide from the
public chain — only the auditor key holder can run them. That is the moat.

Defined in `../lib/src/aml/rules.ts`. All thresholds live in `ComplianceConfig`
(`defaultConfig(decimals)`); amounts are base units.

| Rule | Severity | Fires when | Config |
|---|---|---|---|
| `sanctioned` | high | source or dest is on the denylist | `sanctioned: Set<string>` |
| `threshold` | high | single transfer ≥ report threshold (CTR-style) | `reportThreshold` |
| `structuring` | high | ≥3 sub-threshold out-transfers in window summing ≥ threshold (smurfing) | `reportThreshold`, `windowMs` |
| `velocity-volume` | medium | out-volume in window > limit | `velocityVolumeLimit`, `windowMs` |
| `velocity-count` | medium | out-count in window > limit | `velocityCountLimit`, `windowMs` |
| `concentration` | medium | one peer ≥ ratio of out-volume (funnel/mule) | `concentrationRatio`, `concentrationMinEvents` |
| `layering` | medium | out shortly after a ≥-sized in (pass-through) | `layeringWindowMs` |
| `dormancy` | medium | idle > N days then a material transfer | `dormancyMs` |

## Tuning

```ts
import { defaultConfig } from "solana-confidential-compliance";
const cfg = defaultConfig(6);
cfg.reportThreshold = 3_000n * 10n ** 6n;     // tighter CTR line
cfg.windowMs = 7 * 24 * 3600_000;             // 7-day structuring window
cfg.sanctioned = new Set(loadOfacAddresses()); // your screening list
```

## Custom rules

A rule is just a function. Add domain logic (e.g. flag transfers to freshly
created accounts, or to mixers) and pass a custom ruleset:

```ts
import { defaultRules, ComplianceEngine, type Rule } from "solana-confidential-compliance";

const freshAccountRule: Rule = ({ transfer }) =>
  isNewlyCreated(transfer.destination)
    ? [{ rule: "fresh-account", severity: "low", signature: transfer.signature,
         account: transfer.destination, message: "Funds to a brand-new account" }]
    : [];

const engine = new ComplianceEngine(cfg, [...defaultRules, freshAccountRule]);
```

## Testing your rules

Rules are pure → feed synthetic `DecryptedTransfer`s and assert on flags. See
`../lib/test/engine.test.ts` for the pattern (no network, no crypto). Determinism
is part of the contract: identical input always yields identical flags.
