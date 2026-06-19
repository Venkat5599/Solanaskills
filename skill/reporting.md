# Compliance Reporting

The loop emits **tamper-evident** reports — every `reportEveryN` transfers and once
more at shutdown. A report is the artifact you hand an examiner; treat it as
evidence, not a log line. Built by `buildReport` (`../lib/src/report.ts`).

## Shape

```ts
interface ComplianceReport {
  mint: string;
  auditorPubkey: string;          // provenance: which key produced this
  periodStart: number;            // unix ms
  periodEnd: number;
  transfersReviewed: number;
  totalVolume: bigint;            // decrypted, for the period
  flags: Flag[];
  flagsBySeverity: Record<string, number>;
  generatedAt: number;
  reportHash: string;             // SHA-256 over the canonical body
}
```

## Why the hash (CT07)

`reportHash` is SHA-256 over the **canonical JSON** of the report body (bigints
rendered as decimal strings so serialization is stable). Properties:

- **Tamper-evident** — change one flag, one amount, one timestamp, and the hash
  changes. A later edit is detectable.
- **Chainable** — store each report's `prevHash` to get an append-only audit trail
  an examiner can verify end-to-end.
- **Deterministic** — same body ⇒ same hash on any machine (tested).

```ts
let prevHash = "genesis";
onReport: async (r) => {
  await db.put(r.reportHash, { ...r, prevHash });   // immutable, keyed by hash
  await auditTrail.append(r.reportHash);
  prevHash = r.reportHash;
};
```

## Where each output goes

| Output | Destination | Why |
|---|---|---|
| **High-severity flags** (sanctioned, threshold, structuring) | SOC / case management — **page a human** | these are SAR/CTR candidates, not log noise |
| **Medium flags** (velocity, concentration, layering, dormancy) | analyst queue | corroborating signal; cluster before escalating |
| **Hashed report** | immutable regulator-facing store | the examiner artifact; never mutate, supersede |
| **Raw decrypted amounts** | **nowhere persistent** (CT04) | persisting them rebuilds the plaintext ledger CT exists to prevent |

The report carries **aggregates + flags**, deliberately *not* a per-transfer
plaintext ledger. That is the privacy line: enough to evidence compliance, not
enough to de-anonymize the mint.

## Regulatory mapping (orientation, not legal advice)

| Signal | Typically informs |
|---|---|
| `threshold` | currency-transaction-report-style filings |
| `structuring`, `layering` | suspicious-activity escalation |
| `sanctioned` | immediate hold + sanctions reporting |
| clustered medium flags | enhanced due diligence / case opening |

The skill **surfaces the signal**; your compliance program owns the filing
decision and the legal interpretation in your jurisdiction.

## Superseding (never editing)

Found an error or got late data? Emit a **new** report covering the corrected
period and link it via `prevHash`. Never mutate an emitted report — a changed hash
on an existing record reads as tampering, which is the opposite of what you want
in front of a regulator.
