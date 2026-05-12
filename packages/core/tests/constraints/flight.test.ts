import { describe, it, expect } from "vitest";

import {
  FlightConstraintsSchema,
  passesFlightConstraints,
  type CandidateFlightInfo,
  type LegInfo,
} from "../../src/constraints/flight.js";

const leg = (overrides: Partial<LegInfo> = {}): LegInfo => ({
  priceMinor: 10000,
  currency: "EUR",
  durationMinutes: 150,
  departHour: 12,
  arriveHour: 14,
  ...overrides,
});

const info = (
  outbound: LegInfo | undefined,
  inbound: LegInfo | undefined,
): CandidateFlightInfo => ({
  ...(outbound !== undefined ? { outbound } : {}),
  ...(inbound !== undefined ? { inbound } : {}),
});

describe("FlightConstraintsSchema", () => {
  it("accepts a constraint with just maxDurationMinutes", () => {
    expect(() => FlightConstraintsSchema.parse({ maxDurationMinutes: 240 })).not.toThrow();
  });

  it("accepts a constraint with all four fields", () => {
    expect(() =>
      FlightConstraintsSchema.parse({
        maxDurationMinutes: 240,
        departAfterHour: 18,
        arriveBeforeHour: 10,
        combineMode: "or",
      }),
    ).not.toThrow();
  });

  it("rejects a constraint with no fields set", () => {
    expect(() => FlightConstraintsSchema.parse({})).toThrow(/at least one/);
  });

  it("rejects hours outside 0-23", () => {
    expect(() => FlightConstraintsSchema.parse({ departAfterHour: 24 })).toThrow();
    expect(() => FlightConstraintsSchema.parse({ arriveBeforeHour: -1 })).toThrow();
  });
});

describe("passesFlightConstraints", () => {
  describe("maxDurationMinutes", () => {
    it("passes when both legs are within the limit", () => {
      const c = { maxDurationMinutes: 180 };
      expect(passesFlightConstraints(info(leg({ durationMinutes: 90 }), leg({ durationMinutes: 120 })), c)).toBe(true);
    });

    it("fails when the outbound leg exceeds the limit", () => {
      const c = { maxDurationMinutes: 180 };
      expect(passesFlightConstraints(info(leg({ durationMinutes: 240 }), leg()), c)).toBe(false);
    });

    it("fails when the inbound leg exceeds the limit", () => {
      const c = { maxDurationMinutes: 180 };
      expect(passesFlightConstraints(info(leg(), leg({ durationMinutes: 300 })), c)).toBe(false);
    });

    it("treats missing leg data as passing", () => {
      const c = { maxDurationMinutes: 60 };
      expect(passesFlightConstraints(info(undefined, undefined), c)).toBe(true);
    });
  });

  describe("departAfterHour", () => {
    it("passes when both depart hours are at or after the limit", () => {
      const c = { departAfterHour: 18 };
      expect(passesFlightConstraints(info(leg({ departHour: 19 }), leg({ departHour: 18 })), c)).toBe(true);
    });

    it("fails when a depart hour is before the limit", () => {
      const c = { departAfterHour: 18 };
      expect(passesFlightConstraints(info(leg({ departHour: 8 }), leg({ departHour: 22 })), c)).toBe(false);
    });
  });

  describe("arriveBeforeHour", () => {
    it("passes when both arrive hours are before the limit", () => {
      const c = { arriveBeforeHour: 11 };
      expect(passesFlightConstraints(info(leg({ arriveHour: 9 }), leg({ arriveHour: 10 })), c)).toBe(true);
    });

    it("fails when an arrive hour is at or after the limit", () => {
      const c = { arriveBeforeHour: 11 };
      expect(passesFlightConstraints(info(leg({ arriveHour: 11 }), leg()), c)).toBe(false);
    });
  });

  describe("combineMode", () => {
    it("AND (default): every set constraint must pass", () => {
      const c = { maxDurationMinutes: 180, departAfterHour: 18 };
      // Duration passes but depart fails → AND result is false.
      expect(
        passesFlightConstraints(
          info(leg({ durationMinutes: 150, departHour: 8 }), leg()),
          c,
        ),
      ).toBe(false);
    });

    it("OR: at least one set constraint must pass", () => {
      const c = {
        maxDurationMinutes: 60, // both legs (150min) fail this
        departAfterHour: 18,    // both legs depart at 19 — passes
        combineMode: "or" as const,
      };
      expect(
        passesFlightConstraints(
          info(
            leg({ durationMinutes: 150, departHour: 19 }),
            leg({ durationMinutes: 150, departHour: 19 }),
          ),
          c,
        ),
      ).toBe(true);
    });

    it("OR: false when all set constraints fail", () => {
      const c = {
        maxDurationMinutes: 60,
        departAfterHour: 22,
        combineMode: "or" as const,
      };
      expect(
        passesFlightConstraints(
          info(leg({ durationMinutes: 150, departHour: 8 }), leg({ durationMinutes: 150 })),
          c,
        ),
      ).toBe(false);
    });
  });

  it("passes vacuously when no constraints are set (after schema validation, you wouldn't hit this — but the function is total)", () => {
    expect(passesFlightConstraints(info(leg(), leg()), {})).toBe(true);
  });
});
