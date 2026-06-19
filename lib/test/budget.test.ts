import { describe, expect, test } from "bun:test";
import { BudgetLedger } from "../src/budget.ts";

describe("BudgetLedger", () => {
  test("continues until a cap is hit", () => {
    const b = new BudgetLedger({ maxIterations: 2 });
    expect(b.stopReason(0)).toBeNull();
    b.recordIteration();
    expect(b.stopReason(0)).toBeNull();
    b.recordIteration();
    expect(b.stopReason(0)).toContain("iterations");
  });

  test("circuit breaker trips on consecutive errors", () => {
    const b = new BudgetLedger({ maxConsecutiveErrors: 2 });
    b.recordError();
    expect(b.stopReason(0)).toBeNull();
    b.recordError();
    expect(b.stopReason(0)).toContain("consecutive-errors");
  });

  test("recordSuccess resets the error streak", () => {
    const b = new BudgetLedger({ maxConsecutiveErrors: 2 });
    b.recordError();
    b.recordSuccess();
    b.recordError();
    expect(b.stopReason(0)).toBeNull();
  });

  test("duration cap fires", () => {
    const b = new BudgetLedger({ maxDurationMs: 100 });
    expect(b.stopReason(Date.now() + 1000)).toContain("duration");
  });

  test("manual trip wins", () => {
    const b = new BudgetLedger({});
    b.trip("anomaly");
    expect(b.stopReason(0)).toContain("circuit-breaker: anomaly");
  });
});
