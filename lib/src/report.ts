import type { Flag } from "./types.ts";

export interface ComplianceReportInput {
  mint: string;
  /** Auditor ElGamal pubkey this report was produced under (provenance). */
  auditorPubkey: string;
  periodStart: number;
  periodEnd: number;
  transfersReviewed: number;
  totalVolume: bigint;
  flags: Flag[];
}

export interface ComplianceReport extends ComplianceReportInput {
  generatedAt: number;
  flagsBySeverity: Record<string, number>;
  /** SHA-256 over the canonical report body — tamper-evident audit trail. */
  reportHash: string;
}

/** JSON.stringify replacer that renders bigint as decimal strings. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a hashed, tamper-evident compliance report from accumulated flags. */
export async function buildReport(
  input: ComplianceReportInput,
  now: number = Date.now(),
): Promise<ComplianceReport> {
  const flagsBySeverity: Record<string, number> = {};
  for (const f of input.flags) flagsBySeverity[f.severity] = (flagsBySeverity[f.severity] ?? 0) + 1;

  const body = { ...input, generatedAt: now, flagsBySeverity };
  const reportHash = await sha256Hex(canonical(body));
  return { ...body, reportHash };
}
