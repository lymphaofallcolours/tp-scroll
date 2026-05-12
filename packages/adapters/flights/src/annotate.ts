import type { TripPlan } from "@tp-scroll/core";

import type { FlightProvider, FlightQuote } from "./provider.js";

export type FlightAnnotation = {
  readonly outbound: FlightQuote | null;
  readonly inbound: FlightQuote | null;
};

export type AnnotatedTripPlan = {
  readonly plan: TripPlan;
  readonly annotations: ReadonlyArray<FlightAnnotation>;
  readonly totalPriceMinor: number | null;
  readonly currency: string | null;
};

export type AnnotatePlanArgs = {
  readonly plan: TripPlan;
  readonly provider: FlightProvider;
  readonly origin: string;
  readonly destination: string;
  readonly concurrency?: number;
};

const DEFAULT_CONCURRENCY = 4;

const runWithConcurrency = async <T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> => {
  const out: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= tasks.length) return;
      out[idx] = await tasks[idx]!();
    }
  });
  await Promise.all(workers);
  return out;
};

/**
 * For each trip in the plan, fetch the cheapest direct outbound (origin →
 * destination on trip.departure) and inbound (destination → origin on
 * trip.return) quotes. Concurrency-capped to keep within provider rate limits.
 * Returns an AnnotatedTripPlan with per-trip annotations and an aggregate
 * total price.
 */
export const annotatePlan = async (args: AnnotatePlanArgs): Promise<AnnotatedTripPlan> => {
  const concurrency = Math.max(1, args.concurrency ?? DEFAULT_CONCURRENCY);
  const trips = args.plan.trips;
  if (trips.length === 0) {
    return { plan: args.plan, annotations: [], totalPriceMinor: null, currency: null };
  }

  type Task = { tripIdx: number; leg: "outbound" | "inbound"; quoteP: () => Promise<FlightQuote | null> };
  const tasks: Task[] = [];
  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i]!;
    tasks.push({
      tripIdx: i,
      leg: "outbound",
      quoteP: () =>
        args.provider.cheapestDirect({
          origin: args.origin,
          destination: args.destination,
          date: trip.departure,
        }),
    });
    tasks.push({
      tripIdx: i,
      leg: "inbound",
      quoteP: () =>
        args.provider.cheapestDirect({
          origin: args.destination,
          destination: args.origin,
          date: trip.return,
        }),
    });
  }

  const results = await runWithConcurrency(
    tasks.map((t) => t.quoteP),
    concurrency,
  );

  const annotations: FlightAnnotation[] = trips.map(() => ({ outbound: null, inbound: null }));
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!;
    const q = results[i] ?? null;
    const a = annotations[t.tripIdx]!;
    annotations[t.tripIdx] = t.leg === "outbound"
      ? { outbound: q, inbound: a.inbound }
      : { outbound: a.outbound, inbound: q };
  }

  let totalPriceMinor: number | null = null;
  let currency: string | null = null;
  for (const a of annotations) {
    for (const q of [a.outbound, a.inbound]) {
      if (q === null) continue;
      totalPriceMinor = (totalPriceMinor ?? 0) + q.priceMinor;
      currency = currency ?? q.currency;
    }
  }

  return { plan: args.plan, annotations, totalPriceMinor, currency };
};
