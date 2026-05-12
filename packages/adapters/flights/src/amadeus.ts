import { isoFromDayInt } from "@tp-scroll/core";
import { z } from "zod";

import { resolveIata } from "./airports.js";
import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "./provider.js";

export type AmadeusOptions = {
  readonly clientId: string;
  readonly clientSecret: string;
  /** Amadeus host. Defaults to the test sandbox. */
  readonly baseUrl?: string;
  /** Injectable fetch for tests. */
  readonly fetch?: typeof fetch;
  /** Currency code passed to Amadeus. Defaults to EUR. */
  readonly currency?: string;
};

const DEFAULT_BASE = "https://test.api.amadeus.com";
const DEFAULT_CURRENCY = "EUR";

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const AmadeusPrice = z.object({
  currency: z.string().length(3),
  total: z.string(),
});

const AmadeusOffer = z.object({
  price: AmadeusPrice,
  validatingAirlineCodes: z.array(z.string()).optional(),
  itineraries: z
    .array(z.object({ duration: z.string().optional() }))
    .min(1),
  numberOfBookableSeats: z.number().optional(),
});

const AmadeusResponse = z.object({
  data: z.array(AmadeusOffer),
});

/**
 * Parse an ISO-8601 duration like "PT2H45M" into total minutes. Returns
 * undefined for malformed input — flight quotes can survive without it.
 */
export const parseIsoDurationMinutes = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(s);
  if (!m) return undefined;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const total = hours * 60 + minutes;
  return total === 0 ? undefined : total;
};

export class AmadeusFlightProvider implements FlightProvider {
  readonly name = "amadeus";

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly currency: string;

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(opts: AmadeusOptions) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.fetchFn = opts.fetch ?? globalThis.fetch;
    this.currency = opts.currency ?? DEFAULT_CURRENCY;
  }

  async cheapestDirect(args: CheapestDirectArgs): Promise<FlightQuote | null> {
    const origin = resolveIata(args.origin);
    const destination = resolveIata(args.destination);
    if (origin === null || destination === null) return null;

    const token = await this.getToken();
    const date = isoFromDayInt(args.date);
    const url = new URL(`${this.baseUrl}/v2/shopping/flight-offers`);
    url.searchParams.set("originLocationCode", origin);
    url.searchParams.set("destinationLocationCode", destination);
    url.searchParams.set("departureDate", date);
    url.searchParams.set("adults", "1");
    url.searchParams.set("nonStop", "true");
    url.searchParams.set("max", "5");
    url.searchParams.set("currencyCode", this.currency);

    const res = await this.fetchFn(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Amadeus flight-offers failed: ${res.status} ${res.statusText}`);
    }
    const parsed = AmadeusResponse.parse(await res.json());
    if (parsed.data.length === 0) return null;

    const cheapest = parsed.data.reduce((acc, offer) =>
      parseFloat(offer.price.total) < parseFloat(acc.price.total) ? offer : acc,
    );

    const priceMinor = Math.round(parseFloat(cheapest.price.total) * 100);
    const durationMinutes = parseIsoDurationMinutes(cheapest.itineraries[0]?.duration);
    const carrier = cheapest.validatingAirlineCodes?.[0];

    return {
      origin,
      destination,
      date: args.date,
      priceMinor,
      currency: cheapest.price.currency,
      stops: 0,
      ...(carrier !== undefined ? { carrier } : {}),
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    };
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token !== null && now < this.tokenExpiresAt - 30_000) return this.token;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await this.fetchFn(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Amadeus auth failed: ${res.status} ${res.statusText}`);
    }
    const parsed = TokenResponse.parse(await res.json());
    this.token = parsed.access_token;
    this.tokenExpiresAt = now + parsed.expires_in * 1000;
    return parsed.access_token;
  }
}

/**
 * Construct an AmadeusFlightProvider from the conventional env vars, or
 * return null when credentials aren't available. Callers can fall back to
 * MockFlightProvider when this returns null.
 */
export const amadeusFromEnv = (
  env: Record<string, string | undefined> = process.env,
): AmadeusFlightProvider | null => {
  const clientId = env["TP_SCROLL_AMADEUS_CLIENT_ID"];
  const clientSecret = env["TP_SCROLL_AMADEUS_CLIENT_SECRET"];
  if (clientId === undefined || clientSecret === undefined) return null;
  return new AmadeusFlightProvider({ clientId, clientSecret });
};
