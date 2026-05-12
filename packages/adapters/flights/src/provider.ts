import type { DayInt, LegInfo } from "@tp-scroll/core";
export type { LegInfo };

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
 * Project a FlightQuote into core's `LegInfo` shape. Returns undefined when
 * any required field is missing on the quote.
 */
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
