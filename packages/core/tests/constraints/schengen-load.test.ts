import { describe, it, expect } from "vitest";

import { currentSchengenLoad } from "../../src/constraints/schengen.js";
import { makeSession, makeTrip } from "../fixtures/sessions.js";

const baseRes = "DE"; // Schengen
const baseHome = "GB"; // non-Schengen

describe("currentSchengenLoad", () => {
  it("returns 0 with no trips", () => {
    const session = makeSession({ residenceCountry: baseRes, homeCountry: baseHome });
    const load = currentSchengenLoad({
      trips: [],
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      today: 9700,
      windowDays: 180,
      session,
    });
    expect(load).toBe(0);
  });

  it("counts interior trip days when homeCountry is non-Schengen", () => {
    // 10-day trip 100 days before "today" → 8 interior days outside Schengen
    const session = makeSession({ residenceCountry: baseRes, homeCountry: baseHome });
    const load = currentSchengenLoad({
      trips: [makeTrip({ departure: 9600, return: 9609 })],
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      today: 9700,
      windowDays: 180,
      session,
    });
    // last-home-day mode: dep & ret = residence (in Schengen), interior 8 days = home (non-Schengen)
    expect(load).toBe(8);
  });

  it("returns 0 when both residence and home are in Schengen", () => {
    const session = makeSession({ residenceCountry: "DE", homeCountry: "ES" });
    const load = currentSchengenLoad({
      trips: [makeTrip({ departure: 9600, return: 9609 })],
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      today: 9700,
      windowDays: 180,
      session,
    });
    expect(load).toBe(0);
  });

  it("ignores trips entirely outside the trailing window", () => {
    // trip ends 200 days before today
    const session = makeSession({ residenceCountry: baseRes, homeCountry: baseHome });
    const load = currentSchengenLoad({
      trips: [makeTrip({ departure: 9490, return: 9499 })],
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      today: 9700,
      windowDays: 180,
      session,
    });
    expect(load).toBe(0);
  });

  it("partially counts a trip whose interior overlaps the window boundary", () => {
    // window: today - 179 ... today = days 9521 ... 9700 (180 days inclusive)
    // trip departs day 9515 (before window), returns 9525 (inside window)
    // Interior days 9516..9524 = 9 days; window covers 9521..9524 = 4 interior days
    const session = makeSession({ residenceCountry: baseRes, homeCountry: baseHome });
    const load = currentSchengenLoad({
      trips: [makeTrip({ departure: 9515, return: 9525 })],
      residenceCountry: session.residenceCountry,
      homeCountry: session.homeCountry,
      today: 9700,
      windowDays: 180,
      session,
    });
    expect(load).toBe(4);
  });
});
