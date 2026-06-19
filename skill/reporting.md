# Compliance Reporting

The loop emits **tamper-evident** reports: every `reportEveryN` transfers and once
more at shutdown. Built by `buildReport` (`../lib/src/report.ts`).

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

## Why the hash

`reportHash` is SHA-256 over the canonical JSON of the report body (bigints
rendered as decimal strings). It makes each report **tamper-evident**: persist
the hash and any later edit is detectable. Chain them (store `prevHash`) for an
append-only audit trail a regulator can verify.

```ts
onReport: async (r) => {
  await db.put(r.reportHash, r);     // immutable store keyed by hash
  await auditTrail.append(r.reportHash);
}
```

## What goes where

- **Flags → SOC / case management.** High-severity flags (sanctions, threshold,
  structuring) should page a human analyst, not just log.
- **Reports → regulator-facing record.** The hashed report is the artifact you
  hand an examiner. Do not mutate emitted reports; supersede with a new one.
- **Raw decrypted amounts → nowhere persistent** unless your policy explicitly
  requires it. The report carries aggregates + flags, not a plaintext ledger of
  every amount.

## SAR/CTR mapping

`threshold` flags map to currency-transaction-report style filings;
`structuring`, `layering`, `sanctioned`, and clustered medium flags inform
suspicious-activity escalation. The skill surfaces the signal; your compliance
program owns the filing decision.
