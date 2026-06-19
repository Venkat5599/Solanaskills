---
name: confidential-dryrun
description: Replay a fixture of transfers through the full AML pipeline with no crypto and no network.
---

# /confidential-dryrun

Validate detection coverage and threshold tuning before going live.

## Steps
1. Build a fixture of `ConfidentialTransferRecord`s (synthetic amounts encoded
   with `encodeAmountLE`), or load a captured set.
2. Run them through `ConfidentialComplianceLoop` with `MockAuditorDecryptor` and
   an injected `observe` that serves the fixture once.
3. Inspect emitted `Flag[]` and the final hashed report.
4. Tune `ComplianceConfig` (thresholds, windows, sanctions) until detection
   matches expectations; add custom rules as needed.

## Output
- Per-transfer flags, severity histogram, and the report hash — all offline,
  deterministic, repeatable. No auditor key required.

See `skill/aml-rules.md` and `lib/test/loop.test.ts` for the pattern.
