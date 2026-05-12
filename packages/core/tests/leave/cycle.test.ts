import { describe, it, expect } from "vitest";

import { LeaveCycleSchema } from "../../src/leave/cycle.js";

const valid = {
  id: "cycle-1",
  name: "2026 PhD year",
  kind: "calendar" as const,
  start: 9497, // 2026-01-01 as DayInt
  end: 9861, // 2026-12-31
  totalDays: 25,
  carryover: { mode: "lose" as const },
  bufferAtEnd: 0,
  halfDaysAllowed: false,
  countWeekends: false,
};

describe("LeaveCycleSchema", () => {
  it("accepts a minimally valid calendar cycle", () => {
    expect(() => LeaveCycleSchema.parse(valid)).not.toThrow();
  });

  it("rejects negative totalDays", () => {
    expect(() => LeaveCycleSchema.parse({ ...valid, totalDays: -1 })).toThrow();
  });

  it("rejects bufferAtEnd that exceeds totalDays", () => {
    expect(() => LeaveCycleSchema.parse({ ...valid, totalDays: 5, bufferAtEnd: 6 })).toThrow();
  });

  it("rejects an end before start", () => {
    expect(() => LeaveCycleSchema.parse({ ...valid, start: 100, end: 50 })).toThrow();
  });

  it("accepts cumulative carryover with maxDays", () => {
    const cycle = {
      ...valid,
      carryover: { mode: "cumulative" as const, maxDays: 5 },
    };
    expect(() => LeaveCycleSchema.parse(cycle)).not.toThrow();
  });

  it("rejects cumulative carryover with negative maxDays", () => {
    const cycle = {
      ...valid,
      carryover: { mode: "cumulative" as const, maxDays: -1 },
    };
    expect(() => LeaveCycleSchema.parse(cycle)).toThrow();
  });

  it("accepts a fiscal cycle with resetDayOfYear", () => {
    const cycle = { ...valid, kind: "fiscal" as const, resetDayOfYear: 91 };
    expect(() => LeaveCycleSchema.parse(cycle)).not.toThrow();
  });

  it("accepts bookingHorizonDays when provided", () => {
    expect(() => LeaveCycleSchema.parse({ ...valid, bookingHorizonDays: 14 })).not.toThrow();
  });
});
