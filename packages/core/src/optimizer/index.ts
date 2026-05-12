import type { Clock } from "../calendar/clock.js";
import type { DayInt } from "../calendar/day-int.js";
import type { DayRange } from "../calendar/range.js";
import type { Session } from "../session/session.js";
import { computeTripCost } from "../trips/cost.js";

import { generateCandidates } from "./candidates.js";
import type { TripPlan } from "./plan.js";
import { searchTopK } from "./search.js";

export type OptimizeOptions = {
  readonly clock: Clock;
  readonly holidays: ReadonlySet<DayInt>;
  readonly topK?: number;
  readonly range?: DayRange;
  readonly carryoverFromPrev?: number;
  readonly maxNodes?: number;
};

export const optimize = (session: Session, options: OptimizeOptions): TripPlan[] => {
  const range = options.range ?? { start: session.cycle.start, end: session.cycle.end };

  const bucket = session.buckets[0];
  if (bucket === undefined) {
    throw new Error("Session must have at least one bucket");
  }

  const consumedByActuals = session.trips
    .filter((t) => t.isActual && t.bucketId === bucket.id)
    .reduce((sum, t) => sum + computeTripCost(t, session, options.holidays).leaveCost, 0);

  const carryover =
    session.cycle.carryover.mode === "cumulative"
      ? Math.min(options.carryoverFromPrev ?? 0, session.cycle.carryover.maxDays)
      : 0;

  // Per the spec: total leave consumed across the plan ≤ (cycle.totalDays - bufferAtEnd),
  // net of already-recorded actuals. The cycle is the authoritative cap; buckets are
  // categorization within it.
  const budget = Math.max(
    0,
    session.cycle.totalDays + carryover - consumedByActuals - session.cycle.bufferAtEnd,
  );

  const candidates = generateCandidates(session, options.holidays, options.clock, range);

  return searchTopK(candidates, {
    budget,
    anchors: session.anchors,
    topK: options.topK ?? 5,
    ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
  });
};

export { type TripPlan } from "./plan.js";
export { type PlanScore, scorePlan, compareScores } from "./score.js";
export { type Candidate, generateCandidates } from "./candidates.js";
export { type SearchOptions, searchTopK } from "./search.js";
