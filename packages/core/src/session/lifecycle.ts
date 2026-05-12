import type { DayInt } from "../calendar/day-int.js";
import type { LeaveBucket } from "../leave/bucket.js";
import type { LeaveCycle } from "../leave/cycle.js";
import { computeTripCost } from "../trips/cost.js";

import type { HistoricalCycle, Session } from "./session.js";

export const rollCycle = (
  session: Session,
  nextCycle: LeaveCycle,
  nextBuckets: LeaveBucket[],
): Session => {
  const archived: HistoricalCycle = {
    cycle: session.cycle,
    buckets: session.buckets,
    trips: session.trips,
    blocked: session.blocked,
    anchors: session.anchors,
    extraHolidays: session.extraHolidays,
    overriddenHolidays: session.overriddenHolidays,
  };

  return {
    ...session,
    cycle: nextCycle,
    buckets: nextBuckets,
    trips: [],
    blocked: [],
    anchors: [],
    extraHolidays: [],
    overriddenHolidays: [],
    cycleHistory: [...session.cycleHistory, archived],
    updatedAt: new Date().toISOString(),
  };
};

export const carryoverFromHistory = (
  session: Session,
  holidays: ReadonlySet<DayInt>,
): number => {
  if (session.cycle.carryover.mode !== "cumulative") return 0;
  const maxDays = session.cycle.carryover.maxDays;

  const last = session.cycleHistory.at(-1);
  if (last === undefined) return 0;

  const annual = last.buckets[0];
  if (annual === undefined) return 0;

  // Reconstruct a session-shape for the historical trips' cost computation.
  // We use the CURRENT session's mode/countries/etc — an explicit simplification
  // documented in the v0.2 plan.
  const historicalContext: Session = {
    ...session,
    cycle: last.cycle,
    buckets: last.buckets,
    trips: last.trips,
    blocked: last.blocked,
    anchors: last.anchors,
    extraHolidays: last.extraHolidays,
    overriddenHolidays: last.overriddenHolidays,
  };

  const consumed = last.trips
    .filter((t) => t.isActual && t.bucketId === annual.id)
    .reduce((s, t) => s + computeTripCost(t, historicalContext, holidays).leaveCost, 0);

  const remaining = annual.totalDays - consumed;
  return Math.min(Math.max(0, remaining), maxDays);
};
