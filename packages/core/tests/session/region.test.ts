import { describe, it, expect } from "vitest";

import { RegionOverrideSchema, regionForDay } from "../../src/session/region.js";

describe("RegionOverrideSchema", () => {
  const base = {
    id: "r1",
    name: "summer",
    start: 100,
    end: 200,
  } as const;

  it("accepts a region with no overrides (just a named window)", () => {
    expect(() => RegionOverrideSchema.parse(base)).not.toThrow();
  });

  it("accepts a region with min/max trip overrides", () => {
    expect(() =>
      RegionOverrideSchema.parse({ ...base, minTripDays: 5, maxTripDays: 30 }),
    ).not.toThrow();
  });

  it("rejects end < start", () => {
    expect(() =>
      RegionOverrideSchema.parse({ ...base, start: 200, end: 100 }),
    ).toThrow();
  });

  it("rejects minTripDays > maxTripDays", () => {
    expect(() =>
      RegionOverrideSchema.parse({ ...base, minTripDays: 10, maxTripDays: 5 }),
    ).toThrow();
  });
});

describe("regionForDay", () => {
  const r1 = { id: "r1", name: "spring", start: 100, end: 200 };
  const r2 = { id: "r2", name: "summer", start: 300, end: 400 };

  it("returns the region containing the day", () => {
    expect(regionForDay([r1, r2], 150)?.id).toBe("r1");
    expect(regionForDay([r1, r2], 350)?.id).toBe("r2");
  });

  it("matches inclusively at both endpoints", () => {
    expect(regionForDay([r1, r2], 100)?.id).toBe("r1");
    expect(regionForDay([r1, r2], 200)?.id).toBe("r1");
  });

  it("returns undefined when no region covers the day", () => {
    expect(regionForDay([r1, r2], 250)).toBeUndefined();
  });

  it("returns undefined for an empty region list", () => {
    expect(regionForDay([], 150)).toBeUndefined();
  });
});
