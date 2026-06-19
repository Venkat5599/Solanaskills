import { describe, expect, test } from "bun:test";
import { ComplianceEngine } from "../src/aml/engine.ts";
import { defaultConfig, type DecryptedTransfer } from "../src/types.ts";

const DAY = 24 * 60 * 60 * 1000;
let seq = 0;
function T(over: Partial<DecryptedTransfer>): DecryptedTransfer {
  return {
    signature: `sig${seq++}`,
    slot: seq,
    blockTime: 0,
    mint: "MINT",
    source: "S",
    destination: "D",
    amount: 0n,
    ...over,
  };
}

const unit = 1_000_000n; // 6 decimals

describe("AML engine", () => {
  test("threshold rule flags a single large transfer", () => {
    const eng = new ComplianceEngine(defaultConfig());
    const flags = eng.ingest(T({ amount: 10_000n * unit }));
    expect(flags.some((f) => f.rule === "threshold" && f.severity === "high")).toBe(true);
  });

  test("threshold rule ignores a sub-threshold transfer", () => {
    const eng = new ComplianceEngine(defaultConfig());
    const flags = eng.ingest(T({ amount: 9_999n * unit }));
    expect(flags.some((f) => f.rule === "threshold")).toBe(false);
  });

  test("structuring rule catches split sub-threshold transfers", () => {
    const eng = new ComplianceEngine(defaultConfig());
    eng.ingest(T({ source: "X", amount: 4_000n * unit, blockTime: 0 }));
    eng.ingest(T({ source: "X", amount: 4_000n * unit, blockTime: 1000 }));
    const flags = eng.ingest(T({ source: "X", amount: 4_000n * unit, blockTime: 2000 }));
    expect(flags.some((f) => f.rule === "structuring")).toBe(true);
  });

  test("sanctioned rule flags denylisted counterparty", () => {
    const cfg = defaultConfig();
    cfg.sanctioned.add("BAD");
    const eng = new ComplianceEngine(cfg);
    const flags = eng.ingest(T({ destination: "BAD", amount: 1n * unit }));
    expect(flags.some((f) => f.rule === "sanctioned" && f.account === "BAD")).toBe(true);
  });

  test("velocity rule flags excessive out-volume", () => {
    const cfg = defaultConfig();
    const eng = new ComplianceEngine(cfg);
    // limit is 50_000*unit; push 60_000 across two transfers
    eng.ingest(T({ source: "V", amount: 30_000n * unit, blockTime: 0 }));
    const flags = eng.ingest(T({ source: "V", amount: 31_000n * unit, blockTime: 1000 }));
    expect(flags.some((f) => f.rule === "velocity-volume")).toBe(true);
  });

  test("concentration rule flags funnel to a single peer", () => {
    const eng = new ComplianceEngine(defaultConfig());
    let flags: ReturnType<ComplianceEngine["ingest"]> = [];
    for (let i = 0; i < 6; i++) {
      flags = eng.ingest(T({ source: "F", destination: "PEER", amount: 100n * unit, blockTime: i * 1000 }));
    }
    expect(flags.some((f) => f.rule === "concentration")).toBe(true);
  });

  test("layering rule flags fast in-then-out pass-through", () => {
    const eng = new ComplianceEngine(defaultConfig());
    eng.ingest(T({ source: "A", destination: "MULE", amount: 1_000n * unit, blockTime: 0 }));
    const flags = eng.ingest(T({ source: "MULE", destination: "B", amount: 1_000n * unit, blockTime: 10 * 60 * 1000 }));
    expect(flags.some((f) => f.rule === "layering")).toBe(true);
  });

  test("dormancy rule flags reawakened account moving material funds", () => {
    const eng = new ComplianceEngine(defaultConfig());
    eng.ingest(T({ source: "Z", amount: 5n * unit, blockTime: 0 }));
    const flags = eng.ingest(T({ source: "Z", amount: 2_000n * unit, blockTime: 100 * DAY }));
    expect(flags.some((f) => f.rule === "dormancy")).toBe(true);
  });

  test("clean low-value transfer raises no flags", () => {
    const eng = new ComplianceEngine(defaultConfig());
    const flags = eng.ingest(T({ source: "clean", destination: "alsoClean", amount: 5n * unit }));
    expect(flags.length).toBe(0);
  });

  test("engine is deterministic for identical input", () => {
    const run = () => {
      const eng = new ComplianceEngine(defaultConfig());
      seq = 0;
      return eng.ingestBatch([
        T({ source: "X", amount: 4_000n * unit, blockTime: 0 }),
        T({ source: "X", amount: 4_000n * unit, blockTime: 1 }),
        T({ source: "X", amount: 4_000n * unit, blockTime: 2 }),
      ]).map((f) => f.rule);
    };
    expect(run()).toEqual(run());
  });
});
