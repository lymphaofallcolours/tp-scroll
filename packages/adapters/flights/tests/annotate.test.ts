import { describe, expect, it } from "vitest";
import type { TripPlan } from "@tp-scroll/core";

import { annotatePlan } from "../src/annotate.js";
import { MockFlightProvider } from "../src/mock.js";
import type { CheapestDirectArgs, FlightProvider, FlightQuote } from "../src/provider.js";

const trip = (id: string, departure: number, ret: number) => ({
  id,
  departure,
  return: ret,
  bucketId: "annual",
  isActual: false,
  dayOverrides: [] as never[],
});

const planWith = (trips: ReadonlyArray<ReturnType<typeof trip>>): TripPlan => ({
  trips,
  leaveCostTotal: 0,
  awayDaysTotal: 0,
  anchorCoverage: 0,
  tripCount: trips.length,
});

describe("annotatePlan", () => {
  it("returns empty annotations for an empty plan", async () => {
    const result = await annotatePlan({
      plan: planWith([]),
      provider: new MockFlightProvider(),
      origin: "DE",
      destination: "ES",
    });
    expect(result.annotations).toEqual([]);
    expect(result.totalPriceMinor).toBeNull();
    expect(result.currency).toBeNull();
  });

  it("annotates outbound + return for each trip", async () => {
    const result = await annotatePlan({
      plan: planWith([trip("a", 9500, 9510), trip("b", 9600, 9605)]),
      provider: new MockFlightProvider(),
      origin: "DE",
      destination: "ES",
    });
    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0]?.outbound).not.toBeNull();
    expect(result.annotations[0]?.inbound).not.toBeNull();
    expect(result.annotations[1]?.outbound).not.toBeNull();
    expect(result.annotations[1]?.inbound).not.toBeNull();
  });

  it("outbound is origin → destination on departure; inbound is destination → origin on return", async () => {
    const calls: CheapestDirectArgs[] = [];
    const recording: FlightProvider = {
      name: "rec",
      async cheapestDirect(args) {
        calls.push(args);
        return {
          origin: args.origin,
          destination: args.destination,
          date: args.date,
          priceMinor: 10000,
          currency: "EUR",
        };
      },
    };
    await annotatePlan({
      plan: planWith([trip("a", 9500, 9510)]),
      provider: recording,
      origin: "DE",
      destination: "ES",
    });
    expect(calls).toHaveLength(2);
    expect(calls).toEqual(
      expect.arrayContaining([
        { origin: "DE", destination: "ES", date: 9500 },
        { origin: "ES", destination: "DE", date: 9510 },
      ]),
    );
  });

  it("aggregates totalPriceMinor across all quotes (and reports first currency)", async () => {
    const provider: FlightProvider = {
      name: "fake",
      async cheapestDirect(args) {
        return {
          origin: args.origin,
          destination: args.destination,
          date: args.date,
          priceMinor: 12300,
          currency: "EUR",
        };
      },
    };
    const result = await annotatePlan({
      plan: planWith([trip("a", 9500, 9510), trip("b", 9600, 9605)]),
      provider,
      origin: "DE",
      destination: "ES",
    });
    // 2 trips × 2 legs × 12300 = 49200
    expect(result.totalPriceMinor).toBe(49200);
    expect(result.currency).toBe("EUR");
  });

  it("tolerates null quotes (provider couldn't price one leg)", async () => {
    let i = 0;
    const provider: FlightProvider = {
      name: "spotty",
      async cheapestDirect(args): Promise<FlightQuote | null> {
        const idx = i++;
        if (idx === 1) return null;
        return {
          origin: args.origin,
          destination: args.destination,
          date: args.date,
          priceMinor: 5000,
          currency: "EUR",
        };
      },
    };
    const result = await annotatePlan({
      plan: planWith([trip("a", 9500, 9510)]),
      provider,
      origin: "DE",
      destination: "ES",
      concurrency: 1, // make iteration order deterministic
    });
    expect(result.totalPriceMinor).toBe(5000);
    expect(result.annotations[0]?.outbound).not.toBeNull();
    expect(result.annotations[0]?.inbound).toBeNull();
  });

  it("respects the concurrency cap", async () => {
    let inflight = 0;
    let maxInflight = 0;
    const provider: FlightProvider = {
      name: "slow",
      async cheapestDirect(args) {
        inflight++;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((r) => setTimeout(r, 5));
        inflight--;
        return {
          origin: args.origin,
          destination: args.destination,
          date: args.date,
          priceMinor: 1000,
          currency: "EUR",
        };
      },
    };
    await annotatePlan({
      plan: planWith([
        trip("a", 1, 2),
        trip("b", 3, 4),
        trip("c", 5, 6),
        trip("d", 7, 8),
        trip("e", 9, 10),
      ]),
      provider,
      origin: "DE",
      destination: "ES",
      concurrency: 2,
    });
    expect(maxInflight).toBeLessThanOrEqual(2);
  });
});
