import { describe, expect, test } from "bun:test";
import { buildReport } from "../src/report.ts";
import type { Flag } from "../src/types.ts";

const flags: Flag[] = [
  { rule: "threshold", severity: "high", signature: "s1", account: "A", message: "big" },
  { rule: "velocity-volume", severity: "medium", signature: "s2", account: "B", message: "fast" },
  { rule: "threshold", severity: "high", signature: "s3", account: "C", message: "big" },
];

const input = {
  mint: "MINT",
  auditorPubkey: "AUD",
  periodStart: 0,
  periodEnd: 1000,
  transfersReviewed: 42,
  totalVolume: 123_456n,
  flags,
};

describe("compliance report", () => {
  test("counts flags by severity", async () => {
    const r = await buildReport(input, 5);
    expect(r.flagsBySeverity.high).toBe(2);
    expect(r.flagsBySeverity.medium).toBe(1);
  });

  test("hash is deterministic for identical body", async () => {
    const a = await buildReport(input, 5);
    const b = await buildReport(input, 5);
    expect(a.reportHash).toBe(b.reportHash);
    expect(a.reportHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("hash changes when a flag changes (tamper-evident)", async () => {
    const a = await buildReport(input, 5);
    const tampered = { ...input, flags: [...flags, flags[0]!] };
    const b = await buildReport(tampered, 5);
    expect(a.reportHash).not.toBe(b.reportHash);
  });

  test("serializes bigint volume without throwing", async () => {
    const r = await buildReport(input, 5);
    expect(r.totalVolume).toBe(123_456n);
  });
});
