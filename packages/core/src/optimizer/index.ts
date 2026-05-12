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
  readonly planningBucketId?: string;
};

export const optimize = (session: Session, options: OptimizeOptions): TripPlan[] => {
  const range = options.range ?? { start: session.cycle.start, end: session.cycle.end };

  const planningBucketId = options.planningBucketId ?? session.buckets[0]?.id;
  if (planningBucketId === undefined) {
    throw new Error("Session must have at least one bucket");
  }
  const bucket = session.buckets.find((b) => b.id === planningBucketId);
  if (bucket === undefined) {
    throw new Error(`planningBucketId references unknown bucket: ${planningBucketId}`);
  }

  const consumedByActuals = session.trips
    .filter((t) => t.isActual && t.bucketId === bucket.id)
    .reduce((sum, t) => sum + computeTripCost(t, session, options.holidays).leaveCost, 0);

  const carryover =
    session.cycle.carryover.mode === "cumulative"
      ? Math.min(options.carryoverFromPrev ?? 0, session.cycle.carryover.maxDays)
      : 0;

  // Budget is bucket-scoped: planning trips draw only from this bucket.
  // bufferAtEnd is taken whole off the planning bucket (v0.2 simplification —
  // proportional split deferred until the optimizer has multi-bucket assignment).
  const budget = Math.max(
    0,
    bucket.totalDays + carryover - consumedByActuals - session.cycle.bufferAtEnd,
  );

  const candidates = generateCandidates(
    session,
    options.holidays,
    options.clock,
    range,
    bucket.id,
  );

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
