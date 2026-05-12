import { describe, it, expect } from "vitest";

import { MockFlightProvider, priceFormat } from "../src/index.js";

describe("MockFlightProvider", () => {
  const p = new MockFlightProvider();

  it("returns a quote with all required fields", async () => {
    const q = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(q.origin).toBe("BER");
    expect(q.destination).toBe("MAD");
    expect(q.date).toBe(9500);
    expect(q.priceMinor).toBeGreaterThan(0);
    expect(q.currency).toBe("EUR");
    expect(q.stops).toBe(0);
    expect(q.carrier).toMatch(/^[A-Z0-9]{2}$/);
  });

  it("is deterministic by (origin, destination, date)", async () => {
    const a = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    const b = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(a).toEqual(b);
  });

  it("produces different prices for different routes", async () => {
    const a = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    const b = await p.cheapestDirect({ origin: "BER", destination: "LHR", date: 9500 });
    // Different keys → different hashes → different prices (statistically — and confirmed for these inputs).
    expect(a.priceMinor).not.toBe(b.priceMinor);
  });

  it("produces different prices for different dates on the same route", async () => {
    const a = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    const b = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9700 });
    expect(a.priceMinor).not.toBe(b.priceMinor);
  });

  it("priceFormat renders a sensible major-units string", async () => {
    const q = await p.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(priceFormat(q)).toMatch(/^\d+\.\d{2} EUR$/);
  });
});
