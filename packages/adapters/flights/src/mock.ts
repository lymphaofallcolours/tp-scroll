import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "./provider.js";

const hash = (s: string): number => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * Deterministic mock that always returns a quote. Useful for tests and as the
 * fallback when no real provider's credentials are configured. Price is a
 * function of (origin, destination, date) so re-runs produce stable results.
 */
export class MockFlightProvider implements FlightProvider {
  readonly name = "mock";

  async cheapestDirect(args: CheapestDirectArgs): Promise<FlightQuote> {
    const key = `${args.origin}->${args.destination}@${args.date}`;
    const h = hash(key);
    // Price varies between 40.00 and 380.00 EUR.
    const priceMinor = 4000 + (h % 34000);
    const carriers = ["LH", "IB", "BA", "AF", "KL", "FR", "U2"];
    const carrier = carriers[h % carriers.length]!;
    const durationMinutes = 90 + (h % 240);
    return {
      origin: args.origin,
      destination: args.destination,
      date: args.date,
      priceMinor,
      currency: "EUR",
      carrier,
      stops: 0,
      durationMinutes,
    };
  }
}
