import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { toDayInt } from "../../src/calendar/day-int.js";
import { computeTripCost } from "../../src/trips/cost.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

describe("computeTripCost", () => {
  // 2026-05-11 Mon → 2026-05-17 Sun  (7 days)
  const dep = d("2026-05-11");
  const ret = d("2026-05-17");

  it("does not charge leave for departure/return under last-home-day default", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // Interior weekdays Tue,Wed,Thu,Fri = 4 leave days. Sat/Sun weekend = 0.
    expect(cost.leaveCost).toBe(4);
    expect(cost.travelDays).toBe(2); // dep and ret
  });

  it("counts away-days as days not at residence", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // last-home-day: departure and return are residence (2 days). 5 interior days are home.
    expect(cost.awayDays).toBe(5);
  });

  it("respects a Friday-no-leave-travel override (interior)", () => {
    const friday = d("2026-05-15");
    const session = makeSession();
    const trip = makeTrip({
      departure: dep,
      return: ret,
      dayOverrides: [
        { day: friday, isTravelDay: true, consumesLeave: false, location: "transit" },
      ],
    });
    const cost = computeTripCost(trip, session, new Set());
    // Friday was a weekday with consumesLeave=true → now overridden to false.
    expect(cost.leaveCost).toBe(3);
    expect(cost.travelDays).toBe(3); // dep, friday-travel, ret
  });

  it("respects a Monday-leave-travel override that turns a non-leave departure into a leave day", () => {
    const session = makeSession(); // last-home-day default: dep is residence, no leave
    const trip = makeTrip({
      departure: dep, // Monday
      return: ret,
      dayOverrides: [{ day: dep, isTravelDay: true, consumesLeave: true }],
    });
    const cost = computeTripCost(trip, session, new Set());
    // Default would be 4 (Tue-Fri). Override adds Monday as a leave day → 5.
    expect(cost.leaveCost).toBe(5);
  });

  it("treats public holidays during the trip as 0 leave-cost days", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const holiday = d("2026-05-13"); // Wednesday
    const cost = computeTripCost(trip, session, new Set([holiday]));
    expect(cost.leaveCost).toBe(3);
  });

  it("counts every day when countWeekends=true (cycle override)", () => {
    const session = makeSession({
      cycle: { ...makeSession().cycle, countWeekends: true },
    });
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // Default last-home-day: dep & ret = residence (no leave). Interior 5 days (Tue-Sat) all consume leave.
    expect(cost.leaveCost).toBe(5);
  });

  it("a single-day trip with no overrides costs 0 leave under last-home-day default", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: dep });
    const cost = computeTripCost(trip, session, new Set());
    expect(cost.leaveCost).toBe(0);
    expect(cost.awayDays).toBe(0);
    expect(cost.travelDays).toBe(1);
  });

  it("aggregate consistency: leaveCost + nonLeaveDays = (return - departure + 1)", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    const totalDaysInTrip = ret - dep + 1;
    const nonLeave = totalDaysInTrip - cost.leaveCost;
    expect(cost.leaveCost + nonLeave).toBe(totalDaysInTrip);
  });
});
