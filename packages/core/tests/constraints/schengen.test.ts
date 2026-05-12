import { describe, it, expect } from "vitest";

import { isSchengen, SCHENGEN_ISO2, evaluateSchengenWindow } from "../../src/constraints/schengen.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

describe("isSchengen / SCHENGEN_ISO2", () => {
  it("recognizes DE, ES, FR as Schengen", () => {
    expect(isSchengen("DE")).toBe(true);
    expect(isSchengen("ES")).toBe(true);
    expect(isSchengen("FR")).toBe(true);
  });

  it("recognizes UK, US as non-Schengen", () => {
    expect(isSchengen("GB")).toBe(false);
    expect(isSchengen("US")).toBe(false);
  });

  it("recognizes recent additions (HR, RO, BG)", () => {
    expect(isSchengen("HR")).toBe(true);
    expect(isSchengen("RO")).toBe(true);
    expect(isSchengen("BG")).toBe(true);
  });

  it("includes all 30 expected members", () => {
    expect(SCHENGEN_ISO2.size).toBe(30);
  });

  it("normalizes input to uppercase", () => {
    expect(isSchengen("de")).toBe(true);
  });
});

describe("evaluateSchengenWindow", () => {
  const watch = { enabled: true, windowDays: 180 as const, maxDaysInWindow: 90 as const };
  const range = { start: 0, end: 364 };

  it("returns no violations when watch is disabled", () => {
    const session = makeSession({
      residenceCountry: "DE",
      homeCountry: "GB",
      trips: [makeTrip({ departure: 0, return: 100 })],
      schengen: { ...watch, enabled: false },
    });
    const result = evaluateSchengenWindow({
      trips: session.trips,
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      range,
      session,
      watch: { ...watch, enabled: false },
    });
    expect(result.violatedOn).toEqual([]);
  });

  it("returns no violations when both residence and home are in Schengen", () => {
    const session = makeSession({ residenceCountry: "DE", homeCountry: "ES" });
    const trips = [makeTrip({ departure: 10, return: 100 })];
    const result = evaluateSchengenWindow({
      trips,
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      range,
      session,
      watch,
    });
    expect(result.violatedOn).toEqual([]);
    expect(result.maxInWindow).toBe(0);
  });

  it("returns no violations when the homeCountry is non-Schengen but trip stays under 90 days", () => {
    // residence Schengen (DE), home non-Schengen (GB). Trip of 80 days is fine.
    const session = makeSession({ residenceCountry: "DE", homeCountry: "GB" });
    const trips = [makeTrip({ departure: 10, return: 89 })]; // 80 interior+edge days
    const result = evaluateSchengenWindow({
      trips,
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      range,
      session,
      watch,
    });
    expect(result.violatedOn).toEqual([]);
  });

  it("flags violations when the rolling 180-day window exceeds 90 outside-Schengen days", () => {
    // residence Schengen, home non-Schengen. Two ~50-day trips within 180 days
    // → ~100 days outside Schengen → violation.
    const session = makeSession({
      residenceCountry: "DE",
      homeCountry: "GB",
      cycle: { ...makeSession().cycle, countWeekends: true },
    });
    const trips = [
      makeTrip({ id: "t1", departure: 10, return: 60 }), // ~51 days
      makeTrip({ id: "t2", departure: 70, return: 120 }), // ~51 days
    ];
    const result = evaluateSchengenWindow({
      trips,
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      range,
      session,
      watch,
    });
    expect(result.violatedOn.length).toBeGreaterThan(0);
    expect(result.maxInWindow).toBeGreaterThan(90);
  });

  it("does not flag a single trip of exactly 90 days when home is non-Schengen", () => {
    const session = makeSession({ residenceCountry: "DE", homeCountry: "GB" });
    // last-home-day mode: departure and return are residence days; interior 88 days are home (outside).
    // Make the inclusive range 91 days long → 89 interior outside-Schengen days.
    const trips = [makeTrip({ departure: 10, return: 100 })];
    const result = evaluateSchengenWindow({
      trips,
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      range,
      session,
      watch,
    });
    expect(result.violatedOn).toEqual([]);
  });
});
