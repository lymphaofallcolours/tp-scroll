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
  readonly bookingUrl?: string;
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
