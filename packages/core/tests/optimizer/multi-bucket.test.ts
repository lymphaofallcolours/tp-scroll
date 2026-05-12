import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../src/calendar/clock.js";
import { toDayInt } from "../../src/calendar/day-int.js";
import { optimize } from "../../src/optimizer/index.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));
const clock = FixedClock(d("2025-12-15"));

const twoBucket = () =>
  makeSession({
    cycle: {
      id: "c",
      name: "2026",
      kind: "calendar",
      start: d("2026-01-01"),
      end: d("2026-12-31"),
      totalDays: 30,
      carryover: { mode: "lose" },
      bufferAtEnd: 0,
      halfDaysAllowed: false,
      countWeekends: false,
    },
    buckets: [
      { id: "annual", name: "annual", cycleId: "c", totalDays: 25 },
      { id: "sick", name: "sick", cycleId: "c", totalDays: 5 },
    ],
    minTripDays: 3,
    maxTripDays: 14,
  });

describe("optimize with multiple buckets", () => {
  it("respects the explicit planningBucket option's budget", () => {
    const session = twoBucket();
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      planningBucketId: "annual",
    });
    for (const plan of plans) {
      // Annual bucket has 25; plan should never spend more than 25 leave days
      expect(plan.leaveCostTotal).toBeLessThanOrEqual(25);
    }
  });

  it("uses a different budget when a smaller bucket is the planning bucket", () => {
    const session = twoBucket();
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      planningBucketId: "sick",
    });
    for (const plan of plans) {
      expect(plan.leaveCostTotal).toBeLessThanOrEqual(5);
    }
  });

  it("defaults to the first bucket when planningBucketId is omitted", () => {
    const session = twoBucket();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5 });
    for (const plan of plans) {
      expect(plan.leaveCostTotal).toBeLessThanOrEqual(25);
    }
  });

  it("assigns planned trips to the planning bucket", () => {
    const session = twoBucket();
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      planningBucketId: "annual",
    });
    for (const plan of plans) {
      for (const trip of plan.trips) {
        expect(trip.bucketId).toBe("annual");
      }
    }
  });

  it("throws when planningBucketId references a non-existent bucket", () => {
    const session = twoBucket();
    expect(() =>
      optimize(session, {
        clock,
        holidays: new Set(),
        topK: 5,
        planningBucketId: "ghost",
      }),
    ).toThrow(/ghost/);
  });
});
