import { describe, expect, it } from "vitest";

import { LeaveBucketSchema, bucketKindColor } from "../../src/leave/bucket.js";
import { optimize } from "../../src/optimizer/index.js";
import { FixedClock } from "../../src/calendar/clock.js";
import { Temporal } from "@js-temporal/polyfill";
import { toDayInt } from "../../src/calendar/day-int.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

describe("LeaveBucketSchema.kind", () => {
  it("accepts a bucket with an explicit kind", () => {
    const parsed = LeaveBucketSchema.parse({
      id: "sick",
      name: "sick",
      cycleId: "c1",
      totalDays: 5,
      kind: "sick",
    });
    expect(parsed.kind).toBe("sick");
  });

  it("defaults to 'annual' when the kind field is absent (back-compat)", () => {
    const parsed = LeaveBucketSchema.parse({
      id: "annual",
      name: "annual",
      cycleId: "c1",
      totalDays: 25,
    });
    expect(parsed.kind).toBe("annual");
  });

  it("rejects unknown kinds", () => {
    expect(() =>
      LeaveBucketSchema.parse({
        id: "x",
        name: "x",
        cycleId: "c1",
        totalDays: 1,
        kind: "vacation", // not in the enum
      }),
    ).toThrow();
  });

  it("accepts all five canonical kinds", () => {
    for (const kind of ["annual", "sick", "parental", "conference", "other"] as const) {
      expect(() =>
        LeaveBucketSchema.parse({
          id: kind,
          name: kind,
          cycleId: "c1",
          totalDays: 1,
          kind,
        }),
      ).not.toThrow();
    }
  });
});

describe("bucketKindColor", () => {
  it("returns a CSS custom-property name keyed on the kind", () => {
    expect(bucketKindColor("annual")).toBe("--accent-bucket-annual");
    expect(bucketKindColor("sick")).toBe("--accent-bucket-sick");
    expect(bucketKindColor("parental")).toBe("--accent-bucket-parental");
    expect(bucketKindColor("conference")).toBe("--accent-bucket-conference");
    expect(bucketKindColor("other")).toBe("--accent-bucket-other");
  });
});

describe("optimizer default planning bucket prefers kind='annual'", () => {
  const clock = FixedClock(d("2025-12-15"));

  it("uses the annual bucket even when sick comes first in the array", () => {
    const base = makeSession();
    const session = {
      ...base,
      cycle: {
        ...base.cycle,
        start: d("2026-01-01"),
        end: d("2026-12-31"),
        totalDays: 30,
      },
      buckets: [
        { id: "sick", name: "sick", cycleId: base.cycle.id, totalDays: 5, kind: "sick" as const },
        { id: "annual", name: "annual", cycleId: base.cycle.id, totalDays: 25, kind: "annual" as const },
      ],
      minTripDays: 3,
      maxTripDays: 7,
    };

    const plans = optimize(session, { clock, holidays: new Set(), topK: 3 });
    // Any non-empty plan's trips should be charged to the annual bucket
    // (because planningBucketId defaulted to annual rather than to sick[0]).
    for (const plan of plans) {
      for (const trip of plan.trips) {
        expect(trip.bucketId).toBe("annual");
      }
    }
  });
});
