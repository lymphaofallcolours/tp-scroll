import { describe, it, expect } from "vitest";

import { computeBalance } from "../../src/leave/balance.js";
import { type LeaveCycle } from "../../src/leave/cycle.js";

const cycle: LeaveCycle = {
  id: "c1",
  name: "2026",
  kind: "calendar",
  start: 9497,
  end: 9861,
  totalDays: 25,
  carryover: { mode: "lose" },
  bufferAtEnd: 0,
  halfDaysAllowed: false,
  countWeekends: false,
};

describe("computeBalance", () => {
  it("returns totalDays as remaining when nothing has been consumed", () => {
    const b = computeBalance({ bucketTotal: 25, consumed: 0, cycle });
    expect(b.remaining).toBe(25);
    expect(b.available).toBe(25);
  });

  it("returns 0 remaining when fully consumed", () => {
    const b = computeBalance({ bucketTotal: 25, consumed: 25, cycle });
    expect(b.remaining).toBe(0);
    expect(b.available).toBe(0);
  });

  it("satisfies consumed + remaining = total at every point", () => {
    for (const c of [0, 1, 5, 12, 25]) {
      const b = computeBalance({ bucketTotal: 25, consumed: c, cycle });
      expect(b.consumed + b.remaining).toBe(b.total);
    }
  });

  it("subtracts bufferAtEnd from available but not from remaining", () => {
    const withBuffer = { ...cycle, bufferAtEnd: 5 };
    const b = computeBalance({ bucketTotal: 25, consumed: 10, cycle: withBuffer });
    expect(b.remaining).toBe(15);
    expect(b.available).toBe(10);
    expect(b.buffer).toBe(5);
  });

  it("clamps available to 0 if buffer eats remaining", () => {
    const withBuffer = { ...cycle, bufferAtEnd: 20 };
    const b = computeBalance({ bucketTotal: 25, consumed: 10, cycle: withBuffer });
    expect(b.remaining).toBe(15);
    expect(b.available).toBe(0);
  });

  it("adds carryover when mode is cumulative", () => {
    const cum = { ...cycle, carryover: { mode: "cumulative" as const, maxDays: 5 } };
    const b = computeBalance({ bucketTotal: 25, consumed: 0, cycle: cum, carryoverFromPrev: 3 });
    expect(b.total).toBe(28);
    expect(b.remaining).toBe(28);
  });

  it("caps carryover at maxDays", () => {
    const cum = { ...cycle, carryover: { mode: "cumulative" as const, maxDays: 5 } };
    const b = computeBalance({ bucketTotal: 25, consumed: 0, cycle: cum, carryoverFromPrev: 99 });
    expect(b.total).toBe(30);
  });

  it("ignores carryover when mode is lose", () => {
    const b = computeBalance({ bucketTotal: 25, consumed: 0, cycle, carryoverFromPrev: 10 });
    expect(b.total).toBe(25);
  });

  it("throws when consumed exceeds total (programmer error)", () => {
    expect(() => computeBalance({ bucketTotal: 25, consumed: 30, cycle })).toThrow();
  });

  it("throws when consumed is negative", () => {
    expect(() => computeBalance({ bucketTotal: 25, consumed: -1, cycle })).toThrow();
  });
});
