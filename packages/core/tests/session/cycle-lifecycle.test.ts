import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { toDayInt } from "../../src/calendar/day-int.js";
import type { LeaveBucket } from "../../src/leave/bucket.js";
import type { LeaveCycle } from "../../src/leave/cycle.js";
import { rollCycle, carryoverFromHistory } from "../../src/session/lifecycle.js";
import { SessionSchema } from "../../src/session/session.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

const nextYearCycle = (): LeaveCycle => ({
  id: "c2027",
  name: "2027",
  kind: "calendar",
  start: d("2027-01-01"),
  end: d("2027-12-31"),
  totalDays: 25,
  carryover: { mode: "lose" },
  bufferAtEnd: 0,
  halfDaysAllowed: false,
  countWeekends: false,
});

const nextYearBuckets = (): LeaveBucket[] => [
  { id: "annual", name: "annual", cycleId: "c2027", totalDays: 25 },
];

describe("rollCycle", () => {
  it("archives the current cycle into cycleHistory", () => {
    const session = makeSession();
    const rolled = rollCycle(session, nextYearCycle(), nextYearBuckets());
    expect(rolled.cycleHistory).toHaveLength(1);
    expect(rolled.cycleHistory[0]!.cycle.id).toBe(session.cycle.id);
  });

  it("resets trips, blocked, anchors, and holiday overrides on the active cycle", () => {
    const session = makeSession({
      trips: [makeTrip({ id: "t1", departure: 9600, return: 9610 })],
      blocked: [{ start: 9700, end: 9710, reason: "x" }],
      anchors: [{ day: 9650, preferIn: "home", weight: 5 }],
      extraHolidays: [{ day: 9680, name: "custom" }],
      overriddenHolidays: [{ day: 9690, remove: true }],
    });
    const rolled = rollCycle(session, nextYearCycle(), nextYearBuckets());
    expect(rolled.trips).toEqual([]);
    expect(rolled.blocked).toEqual([]);
    expect(rolled.anchors).toEqual([]);
    expect(rolled.extraHolidays).toEqual([]);
    expect(rolled.overriddenHolidays).toEqual([]);
  });

  it("preserves trips and constraints inside the archived history entry", () => {
    const trip = makeTrip({ id: "t1", departure: 9600, return: 9610 });
    const session = makeSession({ trips: [trip] });
    const rolled = rollCycle(session, nextYearCycle(), nextYearBuckets());
    expect(rolled.cycleHistory[0]!.trips).toContainEqual(trip);
  });

  it("activates the new cycle and buckets", () => {
    const session = makeSession();
    const newCycle = nextYearCycle();
    const newBuckets = nextYearBuckets();
    const rolled = rollCycle(session, newCycle, newBuckets);
    expect(rolled.cycle).toEqual(newCycle);
    expect(rolled.buckets).toEqual(newBuckets);
  });

  it("rolled session passes SessionSchema validation", () => {
    const session = makeSession();
    const rolled = rollCycle(session, nextYearCycle(), nextYearBuckets());
    expect(() => SessionSchema.parse(rolled)).not.toThrow();
  });

  it("supports rolling multiple times — history accumulates oldest-first", () => {
    let session = makeSession();
    session = rollCycle(session, nextYearCycle(), nextYearBuckets());
    const cycle2028: LeaveCycle = {
      ...nextYearCycle(),
      id: "c2028",
      name: "2028",
      start: d("2028-01-01"),
      end: d("2028-12-31"),
    };
    const buckets2028: LeaveBucket[] = [
      { id: "annual", name: "annual", cycleId: "c2028", totalDays: 25 },
    ];
    session = rollCycle(session, cycle2028, buckets2028);
    expect(session.cycleHistory.map((h) => h.cycle.id)).toEqual([
      "s-test-cycle",
      "c2027",
    ]);
  });
});

describe("carryoverFromHistory", () => {
  it("returns 0 when carryover.mode is 'lose'", () => {
    const session = makeSession();
    const rolled = rollCycle(
      { ...session, trips: [] }, // no consumption
      nextYearCycle(),
      nextYearBuckets(),
    );
    expect(carryoverFromHistory(rolled, new Set())).toBe(0);
  });

  it("returns 0 when there is no history", () => {
    const session = makeSession({
      cycle: { ...makeSession().cycle, carryover: { mode: "cumulative", maxDays: 5 } },
    });
    expect(carryoverFromHistory(session, new Set())).toBe(0);
  });

  it("returns previous-cycle leftover, capped at maxDays, when cumulative", () => {
    const base = makeSession({
      cycle: { ...makeSession().cycle, carryover: { mode: "cumulative", maxDays: 10 } },
      trips: [
        // 3 days of leave consumed
        makeTrip({ id: "t1", departure: d("2026-05-11"), return: d("2026-05-15"), isActual: true }),
      ],
    });
    const rolled = rollCycle(
      base,
      {
        ...nextYearCycle(),
        carryover: { mode: "cumulative", maxDays: 10 },
      },
      [{ id: "annual", name: "annual", cycleId: "c2027", totalDays: 25 }],
    );
    // Annual bucket was 25, consumed ~3 → ~22 leftover, capped at maxDays=10 → 10
    expect(carryoverFromHistory(rolled, new Set())).toBe(10);
  });
});
