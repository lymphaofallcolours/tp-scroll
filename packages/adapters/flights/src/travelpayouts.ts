import { isoFromDayInt } from "@tp-scroll/core";
import { z } from "zod";

import { resolveIata } from "./airports.js";
import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "./provider.js";

export type TravelpayoutsOptions = {
  readonly token: string;
  /** Travelpayouts API host. Defaults to the public endpoint. */
  readonly baseUrl?: string;
  /** Injectable fetch for tests. */
  readonly fetch?: typeof fetch;
  /**
   * ISO-4217 currency code. The API defaults to RUB when unspecified, which
   * is virtually never what we want — explicitly default to EUR so the
   * displayed prices match the rest of the app's conventions.
   */
  readonly currency?: string;
};

const DEFAULT_BASE = "https://api.travelpayouts.com";
const DEFAULT_CURRENCY = "EUR";

const PricesEntry = z.object({
  origin_airport: z.string().optional(),
  destination_airport: z.string().optional(),
  price: z.number(),
  airline: z.string().optional(),
  flight_number: z.union([z.string(), z.number()]).optional(),
  departure_at: z.string().optional(),
  return_at: z.string().nullable().optional(),
  transfers: z.number().optional(),
  duration: z.number().optional(),
  duration_to: z.number().optional(),
  duration_back: z.number().optional(),
  link: z.string().optional(),
  expires_at: z.string().optional(),
});

const PricesResponse = z.object({
  success: z.boolean().optional(),
  data: z.array(PricesEntry),
  currency: z.string().optional(),
});

/**
 * Extract the hour (0-23) from a "YYYY-MM-DDTHH:MM:SS[Z|±HH:MM]" timestamp.
 *
 * Travelpayouts returns UTC times (often suffixed with `Z`) — this means the
 * hour we extract is UTC, not local-at-origin. The flight-constraint
 * depart-after/arrive-before filters operate on this hour, so they read as
 * UTC. See docs/design/0012-flights-travelpayouts.md for the airport→tz
 * follow-up note.
 */
const parseUtcHour = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}):/.exec(s);
  if (!m) return undefined;
  const hour = parseInt(m[1]!, 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return undefined;
  return hour;
};

/** Compute arrival hour as (depart hour + duration in minutes) modulo 24. */
const computeArriveHour = (
  departHour: number | undefined,
  durationMinutes: number | undefined,
): number | undefined => {
  if (departHour === undefined || durationMinutes === undefined) return undefined;
  const totalMinutes = departHour * 60 + durationMinutes;
  return Math.floor((totalMinutes / 60) % 24);
};

export class TravelpayoutsFlightProvider implements FlightProvider {
  readonly name = "travelpayouts";

  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly currency: string;

  constructor(opts: TravelpayoutsOptions) {
    this.token = opts.token;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
    this.fetchFn = opts.fetch ?? globalThis.fetch;
    this.currency = opts.currency ?? DEFAULT_CURRENCY;
  }

  async cheapestDirect(args: CheapestDirectArgs): Promise<FlightQuote | null> {
    const origin = resolveIata(args.origin);
    const destination = resolveIata(args.destination);
    if (origin === null || destination === null) return null;

    const date = isoFromDayInt(args.date);
    const url = new URL(`${this.baseUrl}/aviasales/v3/prices_for_dates`);
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("departure_at", date);
    url.searchParams.set("currency", this.currency);
    url.searchParams.set("one_way", "true");
    url.searchParams.set("direct", "true");
    url.searchParams.set("sorting", "price");
    url.searchParams.set("limit", "1");

    const res = await this.fetchFn(url.toString(), {
      headers: {
        "X-Access-Token": this.token,
        accept: "application/json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Travelpayouts prices_for_dates failed: ${res.status} ${res.statusText}`,
      );
    }

    // Tolerate unexpected shapes: if the JSON doesn't validate, treat it as
    // "no data" rather than throwing. The optimizer already handles null
    // annotations gracefully, so a degraded response is preferable to a
    // crash.
    let parsed: z.infer<typeof PricesResponse>;
    try {
      parsed = PricesResponse.parse(await res.json());
    } catch {
      return null;
    }
    if (parsed.data.length === 0) return null;

    // With sorting=price&limit=1 the first item is the cheapest; trust it
    // rather than re-sorting client-side.
    const cheapest = parsed.data[0]!;
    const priceMinor = Math.round(cheapest.price * 100);
    const durationMinutes = cheapest.duration_to ?? cheapest.duration;
    const departHour = parseUtcHour(cheapest.departure_at);
    const arriveHour = computeArriveHour(departHour, durationMinutes);
    const stops = cheapest.transfers ?? 0;

    return {
      origin,
      destination,
      date: args.date,
      priceMinor,
      currency: parsed.currency ?? this.currency,
      stops,
      ...(cheapest.airline !== undefined ? { carrier: cheapest.airline } : {}),
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      ...(departHour !== undefined ? { departHour } : {}),
      ...(arriveHour !== undefined ? { arriveHour } : {}),
    };
  }
}

/**
 * Construct a TravelpayoutsFlightProvider from the conventional env vars, or
 * return null when the token isn't available. The optional
 * `TP_SCROLL_TRAVELPAYOUTS_CURRENCY` env var overrides the default `EUR`.
 */
export const travelpayoutsFromEnv = (
  env: Record<string, string | undefined> = process.env,
): TravelpayoutsFlightProvider | null => {
  const token = env["TP_SCROLL_TRAVELPAYOUTS_TOKEN"];
  if (token === undefined || token === "") return null;
  const currency = env["TP_SCROLL_TRAVELPAYOUTS_CURRENCY"];
  return new TravelpayoutsFlightProvider({
    token,
    ...(currency !== undefined && currency !== "" ? { currency } : {}),
  });
};
