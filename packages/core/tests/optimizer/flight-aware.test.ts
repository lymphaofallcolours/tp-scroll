import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../src/calendar/clock.js";
import { toDayInt } from "../../src/calendar/day-int.js";
import type { CandidateFlightInfo, LegInfo } from "../../src/constraints/flight.js";
import { optimize } from "../../src/optimizer/index.js";
import { compareScores, scorePlan } from "../../src/optimizer/score.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));
const clock = FixedClock(d("2025-12-15"));

const leg = (overrides: Partial<LegInfo> = {}): LegInfo => ({
  priceMinor: 10000,
  currency: "EUR",
  durationMinutes: 120,
  departHour: 12,
  arriveHour: 14,
  ...overrides,
});

const yearSession = () =>
  makeSession({
    cycle: {
      id: "c",
      name: "2026",
      kind: "calendar",
      start: d("2026-01-01"),
      end: d("2026-12-31"),
      totalDays: 25,
      carryover: { mode: "lose" },
      bufferAtEnd: 0,
      halfDaysAllowed: false,
      countWeekends: false,
    },
    minTripDays: 3,
    maxTripDays: 7,
  });

describe("flight-aware optimizer — constraint filtering", () => {
  it("drops candidates whose flights violate maxDurationMinutes", () => {
    const session = {
      ...yearSession(),
      flightConstraints: { maxDurationMinutes: 90 },
    };
    // Every candidate gets a 240-minute outbound — none should pass.
    const flightInfo = (): CandidateFlightInfo => ({
      outbound: leg({ durationMinutes: 240 }),
      inbound: leg({ durationMinutes: 60 }),
    });
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      flightInfo,
    });
    // No candidates → only the empty plan
    expect(plans.length).toBe(1);
    expect(plans[0]!.trips).toHaveLength(0);
  });

  it("keeps candidates whose flights satisfy the constraints", () => {
    const session = {
      ...yearSession(),
      flightConstraints: { maxDurationMinutes: 240 },
    };
    const flightInfo = (): CandidateFlightInfo => ({
      outbound: leg({ durationMinutes: 120 }),
      inbound: leg({ durationMinutes: 90 }),
    });
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      flightInfo,
    });
    // Many candidates fit; we should get the same shape as without constraints.
    const someHaveTrips = plans.some((p) => p.trips.length > 0);
    expect(someHaveTrips).toBe(true);
  });

  it("treats missing flight info as 'passes' (conservative)", () => {
    const session = {
      ...yearSession(),
      flightConstraints: { maxDurationMinutes: 90 },
    };
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 5,
      flightInfo: () => undefined, // no data for any candidate
    });
    // Without data, nothing is disqualified.
    const someHaveTrips = plans.some((p) => p.trips.length > 0);
    expect(someHaveTrips).toBe(true);
  });
});

describe("flight-aware optimizer — priceAware scoring", () => {
  it("plans carry priceTotalMinor when priceAware is set", () => {
    const session = yearSession();
    const flightInfo = (): CandidateFlightInfo => ({
      outbound: leg({ priceMinor: 5000 }),
      inbound: leg({ priceMinor: 4500 }),
    });
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 3,
      flightInfo,
      priceAware: true,
    });
    for (const plan of plans) {
      if (plan.trips.length === 0) {
        expect(plan.priceTotalMinor).toBe(0);
      } else {
        expect(plan.priceTotalMinor).toBe(plan.trips.length * 9500);
      }
    }
  });

  it("priceAware=false leaves priceTotalMinor undefined", () => {
    const session = yearSession();
    const plans = optimize(session, {
      clock,
      holidays: new Set(),
      topK: 3,
      flightInfo: () => ({ outbound: leg(), inbound: leg() }),
      priceAware: false,
    });
    for (const plan of plans) {
      expect(plan.priceTotalMinor).toBeUndefined();
    }
  });

  it("when two plans tie on the existing 4 tiers, the cheaper one wins under priceAware", () => {
    // Construct two candidate scoring sets that produce equal awayDays /
    // leverage / anchor / count but different prices. Test directly via
    // scorePlan/compareScores, not the full optimizer (where matching ties
    // is statistically unreliable).
    const planA = {
      trips: [],
      leaveCostTotal: 5,
      awayDaysTotal: 10,
      anchorCoverage: 0,
      tripCount: 2,
      priceTotalMinor: 20000,
    };
    const planB = {
      trips: [],
      leaveCostTotal: 5,
      awayDaysTotal: 10,
      anchorCoverage: 0,
      tripCount: 2,
      priceTotalMinor: 35000,
    };
    expect(compareScores(scorePlan(planA, true), scorePlan(planB, true))).toBeLessThan(0);
    // Without priceAware, they tie:
    expect(compareScores(scorePlan(planA, false), scorePlan(planB, false))).toBe(0);
  });
});

describe("scorePlan / compareScores back-compat", () => {
  it("returns a 4-tuple when priceAware is false (default)", () => {
    const plan = {
      trips: [],
      leaveCostTotal: 5,
      awayDaysTotal: 10,
      anchorCoverage: 3,
      tripCount: 2,
    };
    expect(scorePlan(plan)).toHaveLength(4);
  });

  it("returns a 5-tuple when priceAware is true", () => {
    const plan = {
      trips: [],
      leaveCostTotal: 5,
      awayDaysTotal: 10,
      anchorCoverage: 3,
      tripCount: 2,
      priceTotalMinor: 10000,
    };
    expect(scorePlan(plan, true)).toHaveLength(5);
  });

  it("compareScores treats a 4-tuple and 5-tuple as equivalent on shared tiers", () => {
    const a = scorePlan({
      trips: [],
      leaveCostTotal: 5,
      awayDaysTotal: 10,
      anchorCoverage: 0,
      tripCount: 1,
    });
    const b = scorePlan(
      {
        trips: [],
        leaveCostTotal: 5,
        awayDaysTotal: 10,
        anchorCoverage: 0,
        tripCount: 1,
        priceTotalMinor: 999,
      },
      true,
    );
    // Comparator iterates min(a.length, b.length) → 4 tiers, ignores price.
    expect(compareScores(a, b)).toBe(0);
  });
});
