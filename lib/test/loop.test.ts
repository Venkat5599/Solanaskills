import { describe, expect, test } from "bun:test";
import { ConfidentialComplianceLoop } from "../src/loop.ts";
import { ComplianceEngine } from "../src/aml/engine.ts";
import { BudgetLedger } from "../src/budget.ts";
import { MockAuditorDecryptor, encodeAmountLE } from "../src/decryptor.ts";
import { defaultConfig, type ConfidentialTransferRecord, type Flag } from "../src/types.ts";

const unit = 1_000_000n;

function rec(over: Partial<ConfidentialTransferRecord> & { amount: bigint }): ConfidentialTransferRecord {
  const { amount, ...rest } = over;
  return {
    signature: rest.signature ?? "sig",
    slot: rest.slot ?? 1,
    blockTime: rest.blockTime ?? 0,
    mint: rest.mint ?? "MINT",
    source: rest.source ?? "S",
    destination: rest.destination ?? "D",
    auditorCiphertext: encodeAmountLE(amount),
  };
}

describe("ConfidentialComplianceLoop", () => {
  test("decrypts, assesses, and emits a hashed final report", async () => {
    const batch: ConfidentialTransferRecord[] = [
      rec({ signature: "a", slot: 1, source: "WHALE", amount: 12_000n * unit }), // threshold
      rec({ signature: "b", slot: 2, source: "clean", destination: "ok", amount: 3n * unit }),
    ];
    let served = false;
    const seenFlags: Flag[] = [];

    const loop = new ConfidentialComplianceLoop({
      mint: "MINT",
      auditorPubkey: "AUD",
      decryptor: new MockAuditorDecryptor(),
      engine: new ComplianceEngine(defaultConfig()),
      budget: new BudgetLedger({ maxIterations: 3 }),
      observe: async () => {
        if (served) return [];
        served = true;
        return batch;
      },
      onFlags: (f) => {
        seenFlags.push(...f);
      },
      sleep: async () => {},
      now: () => 1000,
    });

    const report = await loop.run();
    expect(seenFlags.some((f) => f.rule === "threshold")).toBe(true);
    expect(report.transfersReviewed).toBe(2);
    expect(report.reportHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.mint).toBe("MINT");
  });

  test("budget stops the loop deterministically", async () => {
    const loop = new ConfidentialComplianceLoop({
      mint: "MINT",
      auditorPubkey: "AUD",
      decryptor: new MockAuditorDecryptor(),
      engine: new ComplianceEngine(defaultConfig()),
      budget: new BudgetLedger({ maxIterations: 2 }),
      observe: async () => [], // always empty -> loop relies on budget to stop
      sleep: async () => {},
      now: () => 1000,
    });
    await loop.run();
    expect(loop.stopStatus).toContain("iterations >= 2");
  });

  test("single tick processes a batch", async () => {
    const loop = new ConfidentialComplianceLoop({
      mint: "MINT",
      auditorPubkey: "AUD",
      decryptor: new MockAuditorDecryptor(),
      engine: new ComplianceEngine(defaultConfig()),
      budget: new BudgetLedger({ maxIterations: 1 }),
      observe: async () => [rec({ signature: "x", source: "BIG", amount: 11_000n * unit })],
      now: () => 1,
    });
    const result = await loop.tick();
    expect(result.records).toBe(1);
    expect(result.flags.some((f) => f.rule === "threshold")).toBe(true);
  });
});
