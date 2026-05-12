import { describe, it, expect } from "vitest";

import { FixedClock } from "../../src/calendar/clock.js";
import { respectsBookingHorizon } from "../../src/constraints/booking-horizon.js";
import { type LeaveCycle } from "../../src/leave/cycle.js";
import { makeTrip } from "../fixtures/sessions.js";

const baseCycle: LeaveCycle = {
  id: "c",
  name: "2026",
  kind: "calendar",
  start: 9497,
  end: 9861,
  totalDays: 25,
  carryover: { mode: "lose" },
  bufferAtEnd: 0,
  halfDaysAllowed: false,
  countWeekends: false,
};

describe("respectsBookingHorizon", () => {
  it("returns true when bookingHorizonDays is not set", () => {
    const trip = makeTrip({ isActual: false, departure: 100, return: 110 });
    expect(respectsBookingHorizon(trip, baseCycle, FixedClock(99))).toBe(true);
  });

  it("returns true for an actual trip even within the horizon", () => {
    const trip = makeTrip({ isActual: true, departure: 100, return: 110 });
    const cycle = { ...baseCycle, bookingHorizonDays: 30 };
    expect(respectsBookingHorizon(trip, cycle, FixedClock(99))).toBe(true);
  });

  it("returns false for a planned trip whose departure is within the horizon", () => {
    const trip = makeTrip({ isActual: false, departure: 100, return: 110 });
    const cycle = { ...baseCycle, bookingHorizonDays: 30 };
    expect(respectsBookingHorizon(trip, cycle, FixedClock(80))).toBe(false);
  });

  it("returns true for a planned trip exactly at the horizon boundary", () => {
    const trip = makeTrip({ isActual: false, departure: 110, return: 120 });
    const cycle = { ...baseCycle, bookingHorizonDays: 30 };
    expect(respectsBookingHorizon(trip, cycle, FixedClock(80))).toBe(true);
  });

  it("returns true for a planned trip well beyond the horizon", () => {
    const trip = makeTrip({ isActual: false, departure: 200, return: 210 });
    const cycle = { ...baseCycle, bookingHorizonDays: 14 };
    expect(respectsBookingHorizon(trip, cycle, FixedClock(100))).toBe(true);
  });
});
