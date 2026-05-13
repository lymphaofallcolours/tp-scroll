import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../src/calendar/clock.js";
import { toDayInt } from "../../src/calendar/day-int.js";
import { optimize } from "../../src/optimizer/index.js";
import { tripOverlapsBlocked } from "../../src/constraints/blocked.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

const yearSession = (overrides = {}) =>
  makeSession({
    cycle: {
      id: "c",
      name: "2026",
      kind: "calendar",
      start: d("2026-01-01"),
      end: d("2026-12-31"),
      totalDays: 25,
      carryover: { mode: "lose" },
      bufferAtEnd: 0,
      halfDaysAllowed: false,
      countWeekends: false,
    },
    minTripDays: 3,
    maxTripDays: 14,
    ...overrides,
  });

describe("optimize", () => {
  const clock = FixedClock(d("2025-12-15")); // before cycle starts → no booking-horizon issues

  it("returns the empty plan only when the search range yields no feasible candidate", () => {
    const session = yearSession({
      cycle: {
        ...yearSession().cycle,
        bookingHorizonDays: 9999, // pushes every candidate out of reach
      },
    });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    expect(plans.length).toBeGreaterThanOrEqual(1);
    expect(plans[0]!.trips).toHaveLength(0);
  });

  it("returns at least 5 distinct plans for a normal one-year cycle", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    expect(plans.length).toBeGreaterThanOrEqual(5);
  });

  it("rank-1 plan has more total awayDays than rank-5 plan (or ties)", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    expect(plans[0]!.awayDaysTotal).toBeGreaterThanOrEqual(plans[4]!.awayDaysTotal);
  });

  it("never returns a plan whose total leave cost exceeds (bucketTotal - bufferAtEnd)", () => {
    const base = yearSession();
    const session = yearSession({
      cycle: { ...base.cycle, totalDays: 10, bufferAtEnd: 2 },
      buckets: [{ ...base.buckets[0]!, totalDays: 10 }],
    });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      expect(plan.leaveCostTotal).toBeLessThanOrEqual(8);
    }
  });

  it("never returns a plan whose trips overlap a blocked period", () => {
    const session = yearSession({
      blocked: [{ start: d("2026-09-01"), end: d("2026-09-30"), reason: "teaching" }],
    });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      for (const trip of plan.trips) {
        expect(tripOverlapsBlocked(trip, session.blocked[0]!)).toBe(false);
      }
    }
  });

  it("terminates well under 10 seconds for a full one-year cycle (coverage-tolerant)", () => {
    const session = yearSession();
    const startMs = performance.now();
    optimize(session, { clock, holidays: new Set(), topK: 5 });
    const elapsed = performance.now() - startMs;
    expect(elapsed).toBeLessThan(10_000);
  });

  it("trips inside any returned plan are pairwise non-overlapping", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      const sorted = [...plan.trips].sort((a, b) => a.departure - b.departure);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1]!.return).toBeLessThan(sorted[i]!.departure);
      }
    }
  });

  it("respects minGapDays: consecutive trips are at least minGap apart", () => {
    const session = yearSession({ minGapDays: 21 });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      const sorted = [...plan.trips].sort((a, b) => a.departure - b.departure);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]!.departure - sorted[i - 1]!.return - 1;
        expect(gap).toBeGreaterThanOrEqual(21);
      }
    }
  });

  it("respects maxGapDays: consecutive trips are at most maxGap apart", () => {
    const session = yearSession({ minGapDays: 0, maxGapDays: 14 });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      const sorted = [...plan.trips].sort((a, b) => a.departure - b.departure);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]!.departure - sorted[i - 1]!.return - 1;
        expect(gap).toBeLessThanOrEqual(14);
      }
    }
  });

  it("returned plans are sorted by descending score", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i - 1]!.awayDaysTotal).toBeGreaterThanOrEqual(plans[i]!.awayDaysTotal);
    }
  });

});
