import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { toDayInt } from "../../src/calendar/day-int.js";
import { resolveAttribution } from "../../src/trips/attribution.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

describe("resolveAttribution (default rule)", () => {
  // 2026-05-11 (Mon) → 2026-05-17 (Sun) — a full week including weekend
  const dep = d("2026-05-11");
  const ret = d("2026-05-17");

  it("treats interior weekdays as home, consumesLeave=true (default countWeekends=false)", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const resolved = resolveAttribution(trip, session, new Set());
    // Interior days = Tue, Wed, Thu, Fri (4 weekdays)
    const interior = resolved.filter((r) => r.day > dep && r.day < ret);
    const weekdays = interior.filter(
      (r) => ![6, 7].includes(Temporal.PlainDate.from("2000-01-01").add({ days: r.day }).dayOfWeek),
    );
    for (const day of weekdays) {
      expect(day.location).toBe("home");
      expect(day.consumesLeave).toBe(true);
      expect(day.isTravelDay).toBe(false);
    }
  });

  it("treats weekend days inside the trip as home, consumesLeave=false when countWeekends=false", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: ret });
    const resolved = resolveAttribution(trip, session, new Set());
    const sat = resolved.find((r) => r.day === d("2026-05-16"));
    const sun = resolved.find((r) => r.day === d("2026-05-17"));
    expect(sat?.consumesLeave).toBe(false);
    expect(sun?.consumesLeave).toBe(false);
    expect(sat?.location).toBe("home");
  });

  it("counts weekends as leave when cycle.countWeekends=true", () => {
    const session = makeSession({
      cycle: { ...makeSession().cycle, countWeekends: true },
    });
    const trip = makeTrip({ departure: dep, return: ret });
    const resolved = resolveAttribution(trip, session, new Set());
    const sat = resolved.find((r) => r.day === d("2026-05-16"));
    expect(sat?.consumesLeave).toBe(true);
  });

  it("treats public holidays as home, consumesLeave=false", () => {
    const session = makeSession();
    const holiday = d("2026-05-14"); // Thursday
    const trip = makeTrip({ departure: dep, return: ret });
    const resolved = resolveAttribution(trip, session, new Set([holiday]));
    const h = resolved.find((r) => r.day === holiday);
    expect(h?.consumesLeave).toBe(false);
    expect(h?.location).toBe("home");
  });

  describe("last-home-day mode (default)", () => {
    it("marks the departure day as residence, isTravelDay=true, consumesLeave=false (default)", () => {
      const session = makeSession();
      const trip = makeTrip({ departure: dep, return: ret });
      const resolved = resolveAttribution(trip, session, new Set());
      const departure = resolved.find((r) => r.day === dep);
      expect(departure?.location).toBe("residence");
      expect(departure?.isTravelDay).toBe(true);
      expect(departure?.consumesLeave).toBe(false);
    });

    it("marks the return day as residence, isTravelDay=true, consumesLeave=false (default)", () => {
      const session = makeSession();
      const trip = makeTrip({ departure: dep, return: ret });
      const resolved = resolveAttribution(trip, session, new Set());
      const returning = resolved.find((r) => r.day === ret);
      expect(returning?.location).toBe("residence");
      expect(returning?.isTravelDay).toBe(true);
      expect(returning?.consumesLeave).toBe(false);
    });
  });

  describe("first-away-day mode", () => {
    it("marks departure as transit, isTravelDay=true, consumesLeave=session default", () => {
      const session = makeSession({
        departureMode: "first-away-day",
        travelDayConsumesLeaveByDefault: true,
      });
      const trip = makeTrip({ departure: dep, return: ret });
      const resolved = resolveAttribution(trip, session, new Set());
      const departure = resolved.find((r) => r.day === dep);
      expect(departure?.location).toBe("transit");
      expect(departure?.isTravelDay).toBe(true);
      expect(departure?.consumesLeave).toBe(true);
    });
  });

  describe("overrides", () => {
    it("user override wins over the default rule", () => {
      // Friday travel-out marked as 'travel, no leave'
      const friday = d("2026-05-15"); // interior Friday
      const session = makeSession();
      const trip = makeTrip({
        departure: dep,
        return: ret,
        dayOverrides: [
          { day: friday, isTravelDay: true, consumesLeave: false, location: "transit" },
        ],
      });
      const resolved = resolveAttribution(trip, session, new Set());
      const f = resolved.find((r) => r.day === friday);
      expect(f?.consumesLeave).toBe(false);
      expect(f?.isTravelDay).toBe(true);
      expect(f?.location).toBe("transit");
    });

    it("partial overrides merge with the default rule", () => {
      const friday = d("2026-05-15");
      const session = makeSession();
      const trip = makeTrip({
        departure: dep,
        return: ret,
        dayOverrides: [{ day: friday, isTravelDay: true }],
      });
      const resolved = resolveAttribution(trip, session, new Set());
      const f = resolved.find((r) => r.day === friday);
      // isTravelDay overridden, but consumesLeave/location keep the default
      expect(f?.isTravelDay).toBe(true);
      expect(f?.consumesLeave).toBe(true);
      expect(f?.location).toBe("home");
    });
  });

  it("single-day trip yields exactly one resolved entry", () => {
    const session = makeSession();
    const trip = makeTrip({ departure: dep, return: dep });
    const resolved = resolveAttribution(trip, session, new Set());
    expect(resolved).toHaveLength(1);
  });
});
