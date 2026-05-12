import { describe, expect, it } from "vitest";

import { parseAtHour } from "../src/amadeus.js";
import { MockFlightProvider } from "../src/mock.js";
import { legInfoOf, type FlightQuote } from "../src/provider.js";

describe("parseAtHour", () => {
  it("extracts the hour from an Amadeus 'at' timestamp", () => {
    expect(parseAtHour("2026-04-10T18:45:00")).toBe(18);
    expect(parseAtHour("2026-12-19T07:05:00")).toBe(7);
    expect(parseAtHour("2026-12-19T00:30:00")).toBe(0);
    expect(parseAtHour("2026-12-19T23:59:00")).toBe(23);
  });
  it("returns undefined for malformed input", () => {
    expect(parseAtHour(undefined)).toBeUndefined();
    expect(parseAtHour("nope")).toBeUndefined();
    expect(parseAtHour("2026-04-10")).toBeUndefined();
  });
});

describe("MockFlightProvider — depart/arrive hours", () => {
  it("returns hours within 0..23", async () => {
    const p = new MockFlightProvider();
    for (const date of [9500, 9600, 9700, 9800]) {
      const q = await p.cheapestDirect({ origin: "BER", destination: "MAD", date });
      expect(q.departHour).toBeGreaterThanOrEqual(0);
      expect(q.departHour).toBeLessThanOrEqual(23);
      expect(q.arriveHour).toBeGreaterThanOrEqual(0);
      expect(q.arriveHour).toBeLessThanOrEqual(23);
    }
  });

  it("is deterministic for the same input", async () => {
    const p = new MockFlightProvider();
    const a = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    const b = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(a.departHour).toBe(b.departHour);
    expect(a.arriveHour).toBe(b.arriveHour);
  });

  it("biases departures into the 06:00-22:00 window", async () => {
    const p = new MockFlightProvider();
    for (const date of [9500, 9600, 9700, 9800, 9900, 10000]) {
      const q = await p.cheapestDirect({ origin: "BER", destination: "MAD", date });
      expect(q.departHour).toBeGreaterThanOrEqual(6);
      expect(q.departHour).toBeLessThanOrEqual(22);
    }
  });
});

describe("legInfoOf", () => {
  const full: FlightQuote = {
    origin: "BER",
    destination: "MAD",
    date: 9500,
    priceMinor: 12345,
    currency: "EUR",
    durationMinutes: 165,
    departHour: 18,
    arriveHour: 21,
  };

  it("projects a complete FlightQuote to a complete LegInfo", () => {
    expect(legInfoOf(full)).toEqual({
      priceMinor: 12345,
      currency: "EUR",
      durationMinutes: 165,
      departHour: 18,
      arriveHour: 21,
    });
  });

  it("returns undefined when durationMinutes is missing", () => {
    expect(legInfoOf({ ...full, durationMinutes: undefined })).toBeUndefined();
  });

  it("returns undefined when either hour is missing", () => {
    expect(legInfoOf({ ...full, departHour: undefined })).toBeUndefined();
    expect(legInfoOf({ ...full, arriveHour: undefined })).toBeUndefined();
  });
});
