import { describe, expect, it, vi } from "vitest";

import { AmadeusFlightProvider, parseIsoDurationMinutes, amadeusFromEnv } from "../src/amadeus.js";
import { DEFAULT_AIRPORTS, resolveIata } from "../src/airports.js";

type FetchArgs = Parameters<typeof fetch>;

const okJson = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const tokenBody = (expiresIn = 1800) => ({ access_token: "tok-123", expires_in: expiresIn });

const offersBody = (entries: ReadonlyArray<{ total: string; currency?: string }>) => ({
  data: entries.map((e) => ({
    price: { currency: e.currency ?? "EUR", total: e.total },
    itineraries: [{ duration: "PT2H45M" }],
    validatingAirlineCodes: ["LH"],
    numberOfBookableSeats: 9,
  })),
});

const buildFetch = (handler: (url: string, init: RequestInit | undefined) => Response): vi.Mock<FetchArgs, Promise<Response>> =>
  vi.fn((url, init) => Promise.resolve(handler(String(url), init)));

describe("parseIsoDurationMinutes", () => {
  it("parses hours and minutes", () => {
    expect(parseIsoDurationMinutes("PT2H45M")).toBe(165);
  });
  it("parses minutes-only", () => {
    expect(parseIsoDurationMinutes("PT55M")).toBe(55);
  });
  it("parses hours-only", () => {
    expect(parseIsoDurationMinutes("PT3H")).toBe(180);
  });
  it("returns undefined for malformed input", () => {
    expect(parseIsoDurationMinutes("not a duration")).toBeUndefined();
    expect(parseIsoDurationMinutes(undefined)).toBeUndefined();
  });
});

describe("resolveIata", () => {
  it("passes IATA codes through", () => {
    expect(resolveIata("BER")).toBe("BER");
    expect(resolveIata("ber")).toBe("BER");
  });
  it("maps ISO-2 country codes via DEFAULT_AIRPORTS", () => {
    expect(resolveIata("DE")).toBe(DEFAULT_AIRPORTS["DE"]);
    expect(resolveIata("es")).toBe("MAD");
  });
  it("returns null for unknown shapes", () => {
    expect(resolveIata("12")).toBeNull();
    expect(resolveIata("XX")).toBeNull(); // not in mapping
  });
});

describe("AmadeusFlightProvider", () => {
  it("auths once then queries flight-offers", async () => {
    const fetchFn = buildFetch((url) => {
      if (url.includes("/oauth2/token")) return okJson(tokenBody());
      if (url.includes("/flight-offers")) return okJson(offersBody([{ total: "123.45" }]));
      return new Response("nope", { status: 404 });
    });
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    const q = await provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 });
    expect(q).not.toBeNull();
    expect(q!.priceMinor).toBe(12345);
    expect(q!.currency).toBe("EUR");
    expect(q!.origin).toBe("BER");
    expect(q!.destination).toBe("MAD");
    expect(q!.durationMinutes).toBe(165);
    expect(q!.carrier).toBe("LH");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("picks the cheapest of returned offers", async () => {
    const fetchFn = buildFetch((url) => {
      if (url.includes("token")) return okJson(tokenBody());
      return okJson(offersBody([{ total: "199.99" }, { total: "89.10" }, { total: "210.00" }]));
    });
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    const q = await provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 });
    expect(q!.priceMinor).toBe(8910);
  });

  it("returns null when Amadeus has no offers", async () => {
    const fetchFn = buildFetch((url) => {
      if (url.includes("token")) return okJson(tokenBody());
      return okJson({ data: [] });
    });
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    const q = await provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 });
    expect(q).toBeNull();
  });

  it("returns null when origin or destination is unresolvable", async () => {
    const fetchFn = vi.fn();
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    const q = await provider.cheapestDirect({ origin: "XX", destination: "ZZ", date: 9500 });
    expect(q).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reuses the OAuth token across multiple queries", async () => {
    const fetchFn = buildFetch((url) => {
      if (url.includes("token")) return okJson(tokenBody());
      return okJson(offersBody([{ total: "100.00" }]));
    });
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    await provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 });
    await provider.cheapestDirect({ origin: "DE", destination: "GB", date: 9510 });
    // 1 auth + 2 offers = 3 calls; never re-auths
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("throws on auth failure", async () => {
    const fetchFn = buildFetch(() => new Response("nope", { status: 401 }));
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    await expect(
      provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 }),
    ).rejects.toThrow(/Amadeus auth failed/);
  });

  it("throws on non-2xx flight-offers response (other than 404)", async () => {
    const fetchFn = buildFetch((url) => {
      if (url.includes("token")) return okJson(tokenBody());
      return new Response("server error", { status: 502 });
    });
    const provider = new AmadeusFlightProvider({
      clientId: "id",
      clientSecret: "secret",
      fetch: fetchFn,
    });
    await expect(
      provider.cheapestDirect({ origin: "DE", destination: "ES", date: 9500 }),
    ).rejects.toThrow(/Amadeus flight-offers failed/);
  });
});

describe("amadeusFromEnv", () => {
  it("returns null when env vars are missing", () => {
    expect(amadeusFromEnv({})).toBeNull();
    expect(amadeusFromEnv({ TP_SCROLL_AMADEUS_CLIENT_ID: "x" })).toBeNull();
  });
  it("returns a provider when both env vars are set", () => {
    const provider = amadeusFromEnv({
      TP_SCROLL_AMADEUS_CLIENT_ID: "x",
      TP_SCROLL_AMADEUS_CLIENT_SECRET: "y",
    });
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe("amadeus");
  });
});
