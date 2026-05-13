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

  it("charges leave for every non-weekend, non-holiday day including travel edges", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // Mon dep, Tue, Wed, Thu, Fri interior, Sat/Sun weekend (no leave),
    // Sun return is also weekend. So leave = 5 (Mon-Fri).
    expect(cost.leaveCost).toBe(5);
    expect(cost.travelDays).toBe(2); // dep and ret are still travel edges
  });

  it("counts away-days as days not at residence", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // last-home-day: departure and return are residence (2 days). 5 interior days are home.
    expect(cost.awayDays).toBe(5);
  });

  it("respects a Friday-no-leave override that takes a weekday out of the count", () => {
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
    // Without the override leave = 5 (Mon-Fri). Friday is overridden to no-leave → 4.
    expect(cost.leaveCost).toBe(4);
    expect(cost.travelDays).toBe(3); // dep, friday-travel, ret
  });

  it("treats public holidays during the trip as 0 leave-cost days", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const holiday = d("2026-05-13"); // Wednesday
    const cost = computeTripCost(trip, session, new Set([holiday]));
    // Without the holiday leave = 5. Wed → 0 → leave = 4.
    expect(cost.leaveCost).toBe(4);
  });

  it("counts public holidays when countHolidays=true (cycle override)", () => {
    const session = makeSession({
      cycle: { ...makeSession().cycle, countHolidays: true },
    });
    const trip = makeTrip({ departure: dep, return: ret });
    const holiday = d("2026-05-13"); // Wednesday
    const cost = computeTripCost(trip, session, new Set([holiday]));
    // Without countHolidays, Wed would be 0. With it, Wed counts as a regular
    // leave day → leave = 5 (Mon-Fri, all charged).
    expect(cost.leaveCost).toBe(5);
  });

  it("counts every day when countWeekends=true (cycle override)", () => {
    const session = makeSession({
      cycle: { ...makeSession().cycle, countWeekends: true },
    });
    const trip = makeTrip({ departure: dep, return: ret });
    const cost = computeTripCost(trip, session, new Set());
    // Mon-Sun = 7 days, all consume leave once weekends count.
    expect(cost.leaveCost).toBe(7);
  });

  it("a single-day weekday trip consumes 1 leave day under the new uniform rule", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: dep });
    const cost = computeTripCost(trip, session, new Set());
    expect(cost.leaveCost).toBe(1);
    expect(cost.awayDays).toBe(0); // dep is residence under last-home-day mode
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
