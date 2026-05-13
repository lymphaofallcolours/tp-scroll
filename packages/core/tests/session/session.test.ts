import { describe, it, expect } from "vitest";

import { SessionSchema, defaultSession } from "../../src/session/index.js";

describe("SessionSchema", () => {
  it("accepts a session built via defaultSession", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    expect(() => SessionSchema.parse(session)).not.toThrow();
  });

  it("rejects non-ISO-2 country codes", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "GER",
      homeCountry: "ESP",
    });
    expect(() => SessionSchema.parse(session)).toThrow();
  });

  it("rejects minTripDays greater than maxTripDays", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    expect(() =>
      SessionSchema.parse({ ...session, minTripDays: 30, maxTripDays: 5 }),
    ).toThrow();
  });

  it("defaults departureMode to last-home-day", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    expect(session.departureMode).toBe("last-home-day");
  });

  it("defaults minTripDays=2 and maxTripDays=21", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    expect(session.minTripDays).toBe(2);
    expect(session.maxTripDays).toBe(21);
  });

  it("accepts a session with the alternate departure mode", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    const parsed = SessionSchema.parse({ ...session, departureMode: "first-away-day" });
    expect(parsed.departureMode).toBe("first-away-day");
  });

  it("defaults gap bounds to 0..365 and rejects min > max", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    expect(session.minGapDays).toBe(0);
    expect(session.maxGapDays).toBe(365);
    expect(() =>
      SessionSchema.parse({ ...session, minGapDays: 30, maxGapDays: 5 }),
    ).toThrow();
  });

  it("normalizes country codes to uppercase", () => {
    const session = defaultSession({
      id: "s1",
      name: "2026",
      residenceCountry: "de",
      homeCountry: "es",
    });
    const parsed = SessionSchema.parse(session);
    expect(parsed.residenceCountry).toBe("DE");
    expect(parsed.homeCountry).toBe("ES");
  });
});
