import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../../src/calendar/clock.js";
import { toDayInt } from "../../../src/calendar/day-int.js";
import { tripOverlapsBlocked } from "../../../src/constraints/blocked.js";
import { computeBalance } from "../../../src/leave/balance.js";
import { optimize } from "../../../src/optimizer/index.js";
import { scorePlan, compareScores } from "../../../src/optimizer/score.js";
import { makeSession } from "../../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));
const cycleStart = d("2026-01-01");
const cycleEnd = d("2026-12-31");
const clock = FixedClock(d("2025-12-15"));

const sessionArb = fc.record({
  totalDays: fc.integer({ min: 5, max: 25 }),
  bufferAtEnd: fc.integer({ min: 0, max: 5 }),
  minTripDays: fc.integer({ min: 2, max: 4 }),
  extraLen: fc.integer({ min: 4, max: 14 }),
  blockedCount: fc.integer({ min: 0, max: 3 }),
});

type SessionParams = {
  totalDays: number;
  bufferAtEnd: number;
  minTripDays: number;
  extraLen: number;
  blockedCount: number;
};

const buildSession = (p: SessionParams) => {
  const session = makeSession({
    cycle: {
      id: "c",
      name: "2026",
      kind: "calendar",
      start: cycleStart,
      end: cycleEnd,
      totalDays: p.totalDays,
      carryover: { mode: "lose" },
      bufferAtEnd: Math.min(p.bufferAtEnd, p.totalDays),
      halfDaysAllowed: false,
      countWeekends: false,
    },
    buckets: [{ id: "annual", name: "annual", cycleId: "c", totalDays: p.totalDays }],
    minTripDays: p.minTripDays,
    maxTripDays: p.minTripDays + p.extraLen,
    blocked: Array.from({ length: p.blockedCount }, (_, i) => ({
      start: cycleStart + 30 + i * 60,
      end: cycleStart + 30 + i * 60 + 9,
      reason: `block-${i}`,
    })),
  });
  return session;
};

describe("optimizer invariants (fast-check)", () => {
  it("invariant 1: consumed + remaining = total for every returned plan", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (const plan of plans) {
          const b = computeBalance({
            bucketTotal: p.totalDays,
            consumed: plan.leaveCostTotal,
            cycle: session.cycle,
          });
          expect(b.consumed + b.remaining).toBe(b.total);
        }
      }),
      { numRuns: 25 },
    );
  });

  it("invariant 2: no returned plan violates the leave budget", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const budget = p.totalDays - Math.min(p.bufferAtEnd, p.totalDays);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (const plan of plans) expect(plan.leaveCostTotal).toBeLessThanOrEqual(budget);
      }),
      { numRuns: 25 },
    );
  });

  it("invariant 3: no returned plan overlaps a blocked period", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (const plan of plans) {
          for (const trip of plan.trips) {
            for (const blocked of session.blocked) {
              expect(tripOverlapsBlocked(trip, blocked)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 25 },
    );
  });

  it("invariant 4: trips inside a plan are pairwise non-overlapping", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (const plan of plans) {
          const sorted = [...plan.trips].sort((a, b) => a.departure - b.departure);
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1]!.return).toBeLessThan(sorted[i]!.departure);
          }
        }
      }),
      { numRuns: 25 },
    );
  });

  it("invariant 5: rank-1 plan never has strictly fewer home-days than rank-2", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (let i = 1; i < plans.length; i++) {
          expect(plans[i - 1]!.awayDaysTotal).toBeGreaterThanOrEqual(plans[i]!.awayDaysTotal);
        }
      }),
      { numRuns: 25 },
    );
  });

  it("invariant 6: adding a blocked period never produces a plan covering it", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const params = { ...p, blockedCount: Math.max(1, p.blockedCount) };
        const session = buildSession(params);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (const plan of plans) {
          for (const trip of plan.trips) {
            for (const blocked of session.blocked) {
              expect(tripOverlapsBlocked(trip, blocked)).toBe(false);
            }
          }
        }
      }),
      { numRuns: 20 },
    );
  });

  it("invariant 7: ranking is consistent with the lexicographic comparator", () => {
    fc.assert(
      fc.property(sessionArb, (p) => {
        const session = buildSession(p);
        const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
        for (let i = 1; i < plans.length; i++) {
          expect(compareScores(scorePlan(plans[i - 1]!), scorePlan(plans[i]!))).toBeLessThanOrEqual(
            0,
          );
        }
      }),
      { numRuns: 25 },
    );
  });
});
