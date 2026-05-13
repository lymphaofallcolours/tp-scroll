import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../src/calendar/clock.js";
import { toDayInt } from "../../src/calendar/day-int.js";
import { generateCandidates } from "../../src/optimizer/candidates.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

describe("generateCandidates — region overrides", () => {
  const clock = FixedClock(d("2025-12-15"));

  const baseSession = makeSession({
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

  it("respects the global trip-length bounds when no regions are set", () => {
    const candidates = generateCandidates(
      baseSession,
      new Set(),
      clock,
      { start: baseSession.cycle.start, end: baseSession.cycle.end },
      "annual",
    );
    const lengths = new Set(candidates.map((c) => c.trip.return - c.trip.departure + 1));
    expect(Math.max(...lengths)).toBeLessThanOrEqual(7);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(3);
  });

  it("widens maxTripDays inside a region", () => {
    const session = makeSession({
      ...baseSession,
      regions: [
        {
          id: "summer",
          name: "summer",
          start: d("2026-06-15"),
          end: d("2026-09-15"),
          maxTripDays: 21,
        },
      ],
    });
    const candidates = generateCandidates(
      session,
      new Set(),
      clock,
      { start: session.cycle.start, end: session.cycle.end },
      "annual",
    );
    const insideRegion = candidates.filter(
      (c) => c.trip.departure >= d("2026-06-15") && c.trip.departure <= d("2026-09-15"),
    );
    const outsideRegion = candidates.filter(
      (c) => c.trip.departure < d("2026-06-15") || c.trip.departure > d("2026-09-15"),
    );
    const maxLenInside = Math.max(
      ...insideRegion.map((c) => c.trip.return - c.trip.departure + 1),
    );
    const maxLenOutside = Math.max(
      ...outsideRegion.map((c) => c.trip.return - c.trip.departure + 1),
    );
    expect(maxLenInside).toBeGreaterThan(7);
    expect(maxLenInside).toBeLessThanOrEqual(21);
    expect(maxLenOutside).toBeLessThanOrEqual(7);
  });

  it("tightens minTripDays inside a region", () => {
    const session = makeSession({
      ...baseSession,
      regions: [
        {
          id: "exams",
          name: "exam season",
          start: d("2026-04-01"),
          end: d("2026-04-30"),
          minTripDays: 5,
        },
      ],
    });
    const candidates = generateCandidates(
      session,
      new Set(),
      clock,
      { start: session.cycle.start, end: session.cycle.end },
      "annual",
    );
    const insideRegion = candidates.filter(
      (c) => c.trip.departure >= d("2026-04-01") && c.trip.departure <= d("2026-04-30"),
    );
    const minLenInside = Math.min(
      ...insideRegion.map((c) => c.trip.return - c.trip.departure + 1),
    );
    expect(minLenInside).toBeGreaterThanOrEqual(5);
  });
});
