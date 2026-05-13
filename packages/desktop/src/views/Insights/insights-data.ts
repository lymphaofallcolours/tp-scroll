import { computeTripCost, isoFromDayInt, type DayInt, type Session } from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

export type BurndownSeries = {
  readonly labels: ReadonlyArray<string>;
  readonly actuals: ReadonlyArray<number>;
  readonly projected: ReadonlyArray<number>;
  readonly budget: number;
  readonly buffer: number;
};

/**
 * For each day in the cycle, compute cumulative leave-cost from actual trips
 * (solid line) and from actual + planned trips (dashed projection). The trip's
 * cost is charged on its return day — that's when leave is "spent". Both
 * series are downsampled to weekly granularity for chart readability.
 */
export const buildBurndown = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): BurndownSeries => {
  const holidaySet = new Set(holidays.map((h) => h.day));

  const charges = session.trips.map((t) => ({
    on: t.return,
    cost: computeTripCost(t, session, holidaySet).leaveCost,
    isActual: t.isActual,
  }));

  const labels: string[] = [];
  const actuals: number[] = [];
  const projected: number[] = [];

  let actualSum = 0;
  let projectedSum = 0;

  for (let d: DayInt = session.cycle.start; d <= session.cycle.end; d++) {
    // Apply charges that land on this exact day.
    for (const c of charges) {
      if (c.on === d) {
        if (c.isActual) actualSum += c.cost;
        projectedSum += c.cost;
      }
    }
    // Downsample to weekly samples to keep the chart legible.
    if (
      d === session.cycle.start ||
      d === session.cycle.end ||
      (d - session.cycle.start) % 7 === 0
    ) {
      labels.push(isoFromDayInt(d));
      actuals.push(actualSum);
      projected.push(projectedSum);
    }
  }

  return {
    labels,
    actuals,
    projected,
    budget: session.cycle.totalDays,
    buffer: session.cycle.bufferAtEnd,
  };
};
