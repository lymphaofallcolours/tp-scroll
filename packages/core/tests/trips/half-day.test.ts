import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { toDayInt } from "../../src/calendar/day-int.js";
import { SessionSchema } from "../../src/session/session.js";
import { computeTripCost } from "../../src/trips/cost.js";
import { resolveAttribution } from "../../src/trips/attribution.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

const halfDayAllowed = () =>
  makeSession({
    cycle: { ...makeSession().cycle, halfDaysAllowed: true },
  });

describe("half-day attribution", () => {
  // 2026-05-11 Mon → 2026-05-15 Fri (5 weekdays)
  const dep = d("2026-05-11");
  const ret = d("2026-05-15");

  it("a full-day override charges 1 leave day; a half-day override charges 0.5", () => {
    const session = halfDayAllowed();
    const tripFull = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [{ day: d("2026-05-13"), consumesLeave: true }],
    });
    const tripHalf = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [{ day: d("2026-05-13"), consumesLeave: true, halfDay: true }],
    });
    const costFull = computeTripCost(tripFull, session, new Set());
    const costHalf = computeTripCost(tripHalf, session, new Set());
    expect(costFull.leaveCost - costHalf.leaveCost).toBeCloseTo(0.5);
  });

  it("the resolved attribution carries halfDay through to the output", () => {
    const session = halfDayAllowed();
    const trip = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [{ day: dep, consumesLeave: true, halfDay: true, isTravelDay: true }],
    });
    const resolved = resolveAttribution(trip, session, new Set());
    const departure = resolved.find((r) => r.day === dep);
    expect(departure?.halfDay).toBe(true);
  });

  it("default-rule days never produce halfDay=true", () => {
    const session = halfDayAllowed();
    const trip = makeTrip({ departure: dep, return: ret });
    const resolved = resolveAttribution(trip, session, new Set());
    for (const r of resolved) expect(r.halfDay).toBe(false);
  });

  it("a half-day still counts as 1 awayDay (location, not cost)", () => {
    const session = halfDayAllowed();
    // Wednesday interior with half-day override
    const trip = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [{ day: d("2026-05-13"), consumesLeave: true, halfDay: true }],
    });
    const cost = computeTripCost(trip, session, new Set());
    // Mon-Fri = 5 weekdays. Wed is 0.5; rest are 1 each → 4.5.
    expect(cost.leaveCost).toBeCloseTo(4.5);
    // awayDays counts interior (non-residence) days: Tue, Wed, Thu = 3.
    expect(cost.awayDays).toBe(3);
  });

  it("multiple half-days sum correctly", () => {
    const session = halfDayAllowed();
    const trip = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [
        { day: d("2026-05-12"), consumesLeave: true, halfDay: true },
        { day: d("2026-05-14"), consumesLeave: true, halfDay: true },
      ],
    });
    const cost = computeTripCost(trip, session, new Set());
    // Mon (1) + Tue (0.5) + Wed (1) + Thu (0.5) + Fri (1) = 4.0
    expect(cost.leaveCost).toBeCloseTo(4.0);
  });

  it("a half-day that does not consume leave costs 0 (consumesLeave wins)", () => {
    const session = halfDayAllowed();
    const trip = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [{ day: d("2026-05-13"), consumesLeave: false, halfDay: true }],
    });
    const cost = computeTripCost(trip, session, new Set());
    // Mon (1) + Tue (1) + Wed (0 — override) + Thu (1) + Fri (1) = 4
    expect(cost.leaveCost).toBe(4);
  });
});

describe("session schema enforces halfDaysAllowed", () => {
  const baseSession = () => ({
    ...makeSession({
      cycle: { ...makeSession().cycle, halfDaysAllowed: false },
    }),
  });

  it("rejects a session whose trips contain half-day overrides when cycle disallows them", () => {
    const session = {
      ...baseSession(),
      trips: [
        makeTrip({
          departure: 9500,
          return: 9510,
          dayOverrides: [{ day: 9505, halfDay: true, consumesLeave: true }],
        }),
      ],
    };
    expect(() => SessionSchema.parse(session)).toThrow(/half-day/i);
  });

  it("accepts the same overrides when cycle.halfDaysAllowed = true", () => {
    const session = {
      ...makeSession({
        cycle: { ...makeSession().cycle, halfDaysAllowed: true },
      }),
      trips: [
        makeTrip({
          departure: 9500,
          return: 9510,
          dayOverrides: [{ day: 9505, halfDay: true, consumesLeave: true }],
        }),
      ],
    };
    expect(() => SessionSchema.parse(session)).not.toThrow();
  });
});
