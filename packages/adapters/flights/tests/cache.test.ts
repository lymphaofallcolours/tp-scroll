import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CachingFlightProvider } from "../src/cache.js";
import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "../src/provider.js";

const makeFake = (
  responses: ReadonlyArray<FlightQuote | null>,
): FlightProvider & { calls: number } => {
  let i = 0;
  const obj = {
    name: "fake",
    calls: 0,
    async cheapestDirect(_args: CheapestDirectArgs) {
      obj.calls++;
      const next = responses[i++ % responses.length] ?? null;
      return next;
    },
  };
  return obj;
};

const fixedClock = (start: number): { now: () => number; advance: (ms: number) => void } => {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
};

describe("CachingFlightProvider", () => {
  let provider: FlightProvider & { calls: number };

  beforeEach(() => {
    provider = makeFake([
      { origin: "BER", destination: "MAD", date: 9500, priceMinor: 12345, currency: "EUR" },
    ]);
  });

  afterEach(() => vi.useRealTimers());

  it("returns the delegate's response on a cold miss", async () => {
    const cached = new CachingFlightProvider(provider);
    const q = await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(q?.priceMinor).toBe(12345);
    expect(provider.calls).toBe(1);
  });

  it("serves a cached value on the second call", async () => {
    const cached = new CachingFlightProvider(provider);
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(provider.calls).toBe(1);
  });

  it("normalizes origin/destination case in cache keys", async () => {
    const cached = new CachingFlightProvider(provider);
    await cached.cheapestDirect({ origin: "ber", destination: "mad", date: 9500 });
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(provider.calls).toBe(1);
  });

  it("refetches after TTL expires", async () => {
    const clock = fixedClock(1000);
    const cached = new CachingFlightProvider(provider, { ttlMs: 5000, now: clock.now });
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    clock.advance(4999);
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(provider.calls).toBe(1);
    clock.advance(2);
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(provider.calls).toBe(2);
  });

  it("caches null responses too", async () => {
    const fake = makeFake([null]);
    const cached = new CachingFlightProvider(fake);
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(fake.calls).toBe(1);
  });

  it("evicts oldest entries when maxEntries is exceeded", async () => {
    const cached = new CachingFlightProvider(provider, { maxEntries: 2 });
    await cached.cheapestDirect({ origin: "A", destination: "B", date: 1 });
    await cached.cheapestDirect({ origin: "A", destination: "B", date: 2 });
    expect(cached.size()).toBe(2);
    await cached.cheapestDirect({ origin: "A", destination: "B", date: 3 });
    expect(cached.size()).toBe(2);
  });

  it("invalidate() clears the cache", async () => {
    const cached = new CachingFlightProvider(provider);
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    cached.invalidate();
    await cached.cheapestDirect({ origin: "BER", destination: "MAD", date: 9500 });
    expect(provider.calls).toBe(2);
  });

  it("exposes a descriptive name", () => {
    const cached = new CachingFlightProvider(provider);
    expect(cached.name).toBe("cached(fake)");
  });
});
