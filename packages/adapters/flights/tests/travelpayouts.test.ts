import { describe, expect, it, vi } from "vitest";

import {
  TravelpayoutsFlightProvider,
  travelpayoutsFromEnv,
} from "../src/travelpayouts.js";

const okJson = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

type PriceFields = {
  price: number;
  origin_airport?: string;
  destination_airport?: string;
  airline?: string;
  departure_at?: string;
  transfers?: number;
  duration?: number;
  duration_to?: number;
};

const pricesBody = (entries: ReadonlyArray<PriceFields>) => ({
  success: true,
  currency: "EUR",
  data: entries.map((e) => ({
    origin_airport: e.origin_airport ?? "BER",
    destination_airport: e.destination_airport ?? "MAD",
    price: e.price,
    airline: e.airline ?? "VY",
    flight_number: "1234",
    departure_at: e.departure_at ?? "2026-07-15T18:30:00Z",
    return_at: null,
    transfers: e.transfers ?? 0,
    duration: e.duration ?? 175,
    duration_to: e.duration_to ?? e.duration ?? 175,
    duration_back: 0,
  })),
});

const buildFetch = (
  handler: (url: string, init: RequestInit | undefined) => Response,
) => vi.fn((url: RequestInfo | URL, init?: RequestInit) =>
  Promise.resolve(handler(String(url), init)),
);

describe("TravelpayoutsFlightProvider", () => {
  it("queries prices_for_dates with the expected params + X-Access-Token header", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchFn = buildFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return okJson(pricesBody([{ price: 89.5 }]));
    });
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    expect(q).not.toBeNull();
    expect(capturedUrl).toContain("/aviasales/v3/prices_for_dates");
    expect(capturedUrl).toContain("origin=BER");
    expect(capturedUrl).toContain("destination=MAD");
    expect(capturedUrl).toContain("currency=EUR");
    expect(capturedUrl).toContain("one_way=true");
    expect(capturedUrl).toContain("direct=true");
    expect(capturedUrl).toContain("sorting=price");
    expect(capturedUrl).toContain("limit=1");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["X-Access-Token"]).toBe("t");
  });

  it("transforms the cheapest entry into a FlightQuote", async () => {
    const fetchFn = buildFetch(() =>
      okJson(
        pricesBody([
          {
            price: 89,
            departure_at: "2026-07-15T18:00:00Z",
            duration: 120,
            duration_to: 120,
          },
        ]),
      ),
    );
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    expect(q).not.toBeNull();
    expect(q!.priceMinor).toBe(8900);
    expect(q!.currency).toBe("EUR");
    expect(q!.origin).toBe("BER");
    expect(q!.destination).toBe("MAD");
    expect(q!.durationMinutes).toBe(120);
    expect(q!.carrier).toBe("VY");
    expect(q!.departHour).toBe(18);
    // 18:00 UTC + 120 min = 20:00 UTC.
    expect(q!.arriveHour).toBe(20);
    expect(q!.stops).toBe(0);
  });

  it("handles overnight flights when arrival wraps past midnight", async () => {
    const fetchFn = buildFetch(() =>
      okJson(
        pricesBody([
          {
            price: 75,
            departure_at: "2026-07-15T22:00:00Z",
            duration: 300, // 5h
            duration_to: 300,
          },
        ]),
      ),
    );
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    // 22:00 + 5h = 03:00 next day.
    expect(q!.arriveHour).toBe(3);
  });

  it("returns null when the response data is empty", async () => {
    const fetchFn = buildFetch(() =>
      okJson({ success: true, data: [], currency: "EUR" }),
    );
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    expect(q).toBeNull();
  });

  it("returns null when origin or destination is unresolvable", async () => {
    const fetchFn = vi.fn();
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "XX",
      destination: "ZZ",
      date: 9500,
    });
    expect(q).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns null when the response body fails schema validation", async () => {
    const fetchFn = buildFetch(() => okJson({ unexpected: "shape" }));
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    expect(q).toBeNull();
  });

  it("treats 404 as 'no offers' (returns null)", async () => {
    const fetchFn = buildFetch(() => new Response("not found", { status: 404 }));
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    const q = await provider.cheapestDirect({
      origin: "DE",
      destination: "ES",
      date: 9500,
    });
    expect(q).toBeNull();
  });

  it("throws on non-2xx response (other than 404)", async () => {
    const fetchFn = buildFetch(() => new Response("nope", { status: 502 }));
    const provider = new TravelpayoutsFlightProvider({ token: "t", fetch: fetchFn });
    await expect(
      provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 }),
    ).rejects.toThrow(/Travelpayouts prices_for_dates failed/);
  });

  it("respects a custom currency", async () => {
    let capturedUrl = "";
    const fetchFn = buildFetch((url) => {
      capturedUrl = url;
      return okJson(pricesBody([{ price: 100 }]));
    });
    const provider = new TravelpayoutsFlightProvider({
      token: "t",
      currency: "USD",
      fetch: fetchFn,
    });
    await provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 });
    expect(capturedUrl).toContain("currency=USD");
  });

  it("reports a stable provider name", () => {
    const provider = new TravelpayoutsFlightProvider({ token: "t" });
    expect(provider.name).toBe("travelpayouts");
  });
});

describe("travelpayoutsFromEnv", () => {
  it("returns null when the token env var is missing or empty", () => {
    expect(travelpayoutsFromEnv({})).toBeNull();
    expect(travelpayoutsFromEnv({ TP_SCROLL_TRAVELPAYOUTS_TOKEN: "" })).toBeNull();
  });

  it("returns a provider when the token env var is set", () => {
    const provider = travelpayoutsFromEnv({
      TP_SCROLL_TRAVELPAYOUTS_TOKEN: "abc123",
    });
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe("travelpayouts");
  });

  it("respects the optional currency env var", () => {
    const provider = travelpayoutsFromEnv({
      TP_SCROLL_TRAVELPAYOUTS_TOKEN: "abc",
      TP_SCROLL_TRAVELPAYOUTS_CURRENCY: "GBP",
    });
    expect(provider).not.toBeNull();
  });
});
