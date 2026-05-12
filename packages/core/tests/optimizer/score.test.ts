import { describe, it, expect } from "vitest";

import { type TripPlan } from "../../src/optimizer/plan.js";
import { scorePlan, compareScores } from "../../src/optimizer/score.js";

const plan = (awayDays: number, leaveCost: number, anchors = 0, count = 1): TripPlan => ({
  trips: [],
  leaveCostTotal: leaveCost,
  awayDaysTotal: awayDays,
  anchorCoverage: anchors,
  tripCount: count,
});

describe("scorePlan", () => {
  it("returns [awayDays, leverage, anchors, count] in that order", () => {
    const s = scorePlan(plan(10, 5, 3, 2));
    expect(s).toHaveLength(4);
    expect(s[0]).toBe(10);
    expect(s[2]).toBe(3);
    expect(s[3]).toBe(2);
  });

  it("represents leverage as a high integer when leaveCost is 0", () => {
    const s = scorePlan(plan(10, 0));
    expect(s[1]).toBe(Number.POSITIVE_INFINITY);
  });

  it("computes integer leverage as away/leave * 10000", () => {
    const s = scorePlan(plan(10, 5));
    expect(s[1]).toBe(20000);
  });
});

describe("compareScores", () => {
  it("ranks higher awayDays first", () => {
    expect(compareScores(scorePlan(plan(20, 5)), scorePlan(plan(10, 5)))).toBeLessThan(0);
  });

  it("breaks ties by leverage", () => {
    // 20 home/5 leave (leverage 4) vs 20 home/10 leave (leverage 2)
    expect(compareScores(scorePlan(plan(20, 5)), scorePlan(plan(20, 10)))).toBeLessThan(0);
  });

  it("breaks tier 1+2 ties by anchor coverage", () => {
    expect(compareScores(scorePlan(plan(20, 5, 3)), scorePlan(plan(20, 5, 1)))).toBeLessThan(0);
  });

  it("breaks tier 1+2+3 ties by tripCount", () => {
    expect(compareScores(scorePlan(plan(20, 5, 3, 4)), scorePlan(plan(20, 5, 3, 2)))).toBeLessThan(
      0,
    );
  });

  it("returns 0 for identical plans", () => {
    expect(compareScores(scorePlan(plan(20, 5, 3, 2)), scorePlan(plan(20, 5, 3, 2)))).toBe(0);
  });

  it("strictly more home-days never ranks below identical plan with fewer home-days", () => {
    // Property check sanity
    const a = scorePlan(plan(100, 10, 5, 5));
    const b = scorePlan(plan(50, 10, 5, 5));
    expect(compareScores(a, b)).toBeLessThan(0);
  });
});
