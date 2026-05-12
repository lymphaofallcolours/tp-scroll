import type { DayInt } from "@tp-scroll/core";

export type FlightQuote = {
  readonly origin: string;
  readonly destination: string;
  readonly date: DayInt;
  /** Price in minor units of currency (cents/pennies). Integer. */
  readonly priceMinor: number;
  /** ISO-4217 currency code. */
  readonly currency: string;
  readonly carrier?: string;
  readonly stops?: number;
  readonly durationMinutes?: number;
  /** Hour-of-day (0-23) of scheduled departure in the origin's local time. */
  readonly departHour?: number;
  /** Hour-of-day (0-23) of scheduled arrival in the destination's local time. */
  readonly arriveHour?: number;
  readonly bookingUrl?: string;
};

/**
 * Pure-data projection of a FlightQuote that the optimizer can reason about
 * without depending on the FlightProvider interface. All four fields are
 * required — `legInfoOf` returns undefined when any is missing.
 */
export type LegInfo = {
  readonly priceMinor: number;
  readonly currency: string;
  readonly durationMinutes: number;
  readonly departHour: number;
  readonly arriveHour: number;
};

export const legInfoOf = (quote: FlightQuote): LegInfo | undefined => {
  if (
    quote.durationMinutes === undefined ||
    quote.departHour === undefined ||
    quote.arriveHour === undefined
  ) {
    return undefined;
  }
  return {
    priceMinor: quote.priceMinor,
    currency: quote.currency,
    durationMinutes: quote.durationMinutes,
    departHour: quote.departHour,
    arriveHour: quote.arriveHour,
  };
};

export type CheapestDirectArgs = {
  readonly origin: string;
  readonly destination: string;
  readonly date: DayInt;
};

export type FlightProvider = {
  readonly name: string;
  cheapestDirect(args: CheapestDirectArgs): Promise<FlightQuote | null>;
};

export const priceFormat = (quote: FlightQuote): string => {
  const major = (quote.priceMinor / 100).toFixed(2);
  return `${major} ${quote.currency}`;
};
