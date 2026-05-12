import { describe, it, expect } from "vitest";

import { type AnchorDate, anchorSatisfied, anchorCoverageScore } from "../../src/constraints/anchor.js";

const anchor = (day: number, preferIn: "home" | "residence", weight = 1): AnchorDate => ({
  day,
  preferIn,
  weight,
});

describe("anchorSatisfied", () => {
  it("returns true for a home-anchor when the day is at home", () => {
    expect(anchorSatisfied(anchor(100, "home"), (d) => d === 100)).toBe(true);
  });

  it("returns false for a home-anchor when the day is at residence", () => {
    expect(anchorSatisfied(anchor(100, "home"), () => false)).toBe(false);
  });

  it("returns true for a residence-anchor when the day is at residence", () => {
    expect(anchorSatisfied(anchor(100, "residence"), () => false)).toBe(true);
  });

  it("returns false for a residence-anchor when the day is at home", () => {
    expect(anchorSatisfied(anchor(100, "residence"), (d) => d === 100)).toBe(false);
  });
});

describe("anchorCoverageScore", () => {
  it("returns 0 when no anchors are satisfied", () => {
    expect(anchorCoverageScore([anchor(100, "home", 5)], () => false)).toBe(0);
  });

  it("sums the weights of satisfied anchors", () => {
    const anchors = [anchor(1, "home", 5), anchor(2, "home", 3), anchor(3, "residence", 7)];
    // Day 1 satisfied (at home), day 2 not, day 3 satisfied (at residence)
    const score = anchorCoverageScore(anchors, (d) => d === 1);
    expect(score).toBe(5 + 7);
  });

  it("returns 0 for an empty list", () => {
    expect(anchorCoverageScore([], () => true)).toBe(0);
  });
});
