import { describe, it, expect } from "vitest";

import { type DayRange, daysIn, overlaps, intersect, iterate } from "../../src/calendar/range.js";

const r = (start: number, end: number): DayRange => ({ start, end });

describe("DayRange", () => {
  describe("daysIn (inclusive)", () => {
    it("returns 1 for a single-day range", () => {
      expect(daysIn(r(100, 100))).toBe(1);
    });

    it("returns end - start + 1", () => {
      expect(daysIn(r(100, 109))).toBe(10);
    });

    it("returns 0 for an inverted (empty) range", () => {
      expect(daysIn(r(110, 100))).toBe(0);
    });
  });

  describe("overlaps", () => {
    it("returns true when ranges share at least one day", () => {
      expect(overlaps(r(0, 5), r(5, 10))).toBe(true);
    });

    it("returns false when ranges are adjacent but disjoint", () => {
      expect(overlaps(r(0, 4), r(5, 10))).toBe(false);
    });

    it("returns true when one fully contains the other", () => {
      expect(overlaps(r(0, 100), r(40, 50))).toBe(true);
    });

    it("returns false when ranges are far apart", () => {
      expect(overlaps(r(0, 5), r(100, 105))).toBe(false);
    });
  });

  describe("intersect", () => {
    it("returns the shared sub-range when overlapping", () => {
      expect(intersect(r(0, 10), r(5, 15))).toEqual({ start: 5, end: 10 });
    });

    it("returns null when disjoint", () => {
      expect(intersect(r(0, 4), r(5, 10))).toBeNull();
    });
  });

  describe("iterate", () => {
    it("yields every day from start to end inclusive", () => {
      expect([...iterate(r(0, 3))]).toEqual([0, 1, 2, 3]);
    });

    it("yields nothing for an inverted range", () => {
      expect([...iterate(r(10, 5))]).toEqual([]);
    });

    it("yields exactly the start for a single-day range", () => {
      expect([...iterate(r(7, 7))]).toEqual([7]);
    });
  });
});
