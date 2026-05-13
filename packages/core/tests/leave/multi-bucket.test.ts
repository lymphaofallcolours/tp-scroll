import { describe, it, expect } from "vitest";

import { SessionSchema } from "../../src/session/session.js";
import { computeBucketBalances } from "../../src/leave/balance.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const twoBucketSession = () =>
  makeSession({
    cycle: { ...makeSession().cycle, totalDays: 30 },
    buckets: [
      { id: "annual", name: "annual", cycleId: "s-test-cycle", totalDays: 25 },
      { id: "sick", name: "sick", cycleId: "s-test-cycle", totalDays: 5 },
    ],
  });

describe("SessionSchema multi-bucket validation", () => {
  it("accepts a session with multiple buckets whose totals sum to cycle.totalDays", () => {
    expect(() => SessionSchema.parse(twoBucketSession())).not.toThrow();
  });

  it("rejects a session whose bucket totals exceed cycle.totalDays", () => {
    const session = {
      ...twoBucketSession(),
      buckets: [
        { id: "annual", name: "annual", cycleId: "s-test-cycle", totalDays: 25 },
        { id: "sick", name: "sick", cycleId: "s-test-cycle", totalDays: 10 },
      ],
    };
    expect(() => SessionSchema.parse(session)).toThrow(/bucket totals/i);
  });

  it("rejects a session whose bucket totals are less than cycle.totalDays", () => {
    const session = {
      ...twoBucketSession(),
      buckets: [
        { id: "annual", name: "annual", cycleId: "s-test-cycle", totalDays: 20 },
        { id: "sick", name: "sick", cycleId: "s-test-cycle", totalDays: 5 },
      ],
    };
    expect(() => SessionSchema.parse(session)).toThrow(/bucket totals/i);
  });

  it("rejects duplicate bucket ids", () => {
    const session = {
      ...twoBucketSession(),
      buckets: [
        { id: "annual", name: "annual", cycleId: "s-test-cycle", totalDays: 15 },
        { id: "annual", name: "sick", cycleId: "s-test-cycle", totalDays: 15 },
      ],
    };
    expect(() => SessionSchema.parse(session)).toThrow(/duplicate/i);
  });

  it("rejects a trip referencing a non-existent bucket", () => {
    const session = {
      ...twoBucketSession(),
      trips: [makeTrip({ bucketId: "ghost", departure: 9500, return: 9510 })],
    };
    expect(() => SessionSchema.parse(session)).toThrow(/bucket.*ghost/i);
  });
});

describe("computeBucketBalances", () => {
  it("returns one balance per bucket, with consumed=0 when there are no trips", () => {
    const session = twoBucketSession();
    const balances = computeBucketBalances(session, new Set());
    expect(balances.map((b) => b.bucketId).sort()).toEqual(["annual", "sick"]);
    for (const b of balances) expect(b.balance.consumed).toBe(0);
  });

  it("attributes each trip's cost to its bucket", () => {
    const session = {
      ...twoBucketSession(),
      // 2026-05-11 Mon → 2026-05-15 Fri = 5 weekdays of leave under the
      // uniform rule (travel-edge days no longer free).
      trips: [
        makeTrip({
          id: "t1",
          bucketId: "annual",
          departure: 9627,
          return: 9631,
          isActual: true,
        }),
      ],
    };
    const balances = computeBucketBalances(session, new Set());
    const annual = balances.find((b) => b.bucketId === "annual")!;
    const sick = balances.find((b) => b.bucketId === "sick")!;
    expect(annual.balance.consumed).toBe(5);
    expect(sick.balance.consumed).toBe(0);
    expect(annual.balance.remaining).toBe(20);
    expect(sick.balance.remaining).toBe(5);
  });

  it("ignores planned trips for consumption (only actuals count)", () => {
    const session = {
      ...twoBucketSession(),
      trips: [
        makeTrip({ bucketId: "annual", departure: 9627, return: 9631, isActual: false }),
      ],
    };
    const balances = computeBucketBalances(session, new Set());
    const annual = balances.find((b) => b.bucketId === "annual")!;
    expect(annual.balance.consumed).toBe(0);
  });
});
