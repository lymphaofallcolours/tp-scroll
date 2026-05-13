import type { Clock } from "../calendar/clock.js";
import type { DayInt } from "../calendar/day-int.js";
import type { DayRange } from "../calendar/range.js";
import { passesFlightConstraints, type CandidateFlightInfo } from "../constraints/flight.js";
import type { Session } from "../session/session.js";
import { computeTripCost } from "../trips/cost.js";

import { generateCandidates, type Candidate } from "./candidates.js";
import type { TripPlan } from "./plan.js";
import { compareScores, scorePlan } from "./score.js";
import { searchTopK } from "./search.js";

export type OptimizeOptions = {
  readonly clock: Clock;
  readonly holidays: ReadonlySet<DayInt>;
  readonly topK?: number;
  readonly range?: DayRange;
  readonly carryoverFromPrev?: number;
  readonly maxNodes?: number;
  readonly planningBucketId?: string;
  readonly diversityThreshold?: number;
  /**
   * Number of "seed segments" to run. The cycle is partitioned into N
   * equal-width start-day segments; for each segment the search runs
   * constrained so the first trip's departure falls within that segment.
   * Plans from every segment merge into the final top-K.
   *
   * Default 1 (single search, no constraint — same as previous behavior).
   * Set higher (e.g. 5) for genuinely diverse top-K at proportional CPU
   * cost. Capped above 12 because anything more degrades each seed's
   * search depth.
   */
  readonly seedCount?: number;
  /**
   * Per-candidate flight-info lookup. Keyed by `candidate.trip.id`. Returning
   * undefined means "no data" — the optimizer treats that conservatively
   * (constraints pass; price is omitted from the score). v1.7.
   */
  readonly flightInfo?: (candidateTripId: string) => CandidateFlightInfo | undefined;
  /**
   * When true, the score gains a 5th tier on price (lower wins among ties on
   * the existing 4 tiers). Requires either flightInfo to provide prices or
   * candidate.priceMinor to be set in advance. v1.7.
   */
  readonly priceAware?: boolean;
};

const annotateCandidates = (
  candidates: ReadonlyArray<Candidate>,
  session: Session,
  flightInfo: ((id: string) => CandidateFlightInfo | undefined) | undefined,
): Candidate[] => {
  if (flightInfo === undefined) return [...candidates];
  const constraints = session.flightConstraints;
  const out: Candidate[] = [];
  for (const c of candidates) {
    const info = flightInfo(c.trip.id);
    if (constraints !== undefined && info !== undefined && !passesFlightConstraints(info, constraints)) {
      continue;
    }
    if (info === undefined) {
      out.push(c);
      continue;
    }
    const price = (info.outbound?.priceMinor ?? 0) + (info.inbound?.priceMinor ?? 0);
    out.push({ ...c, priceMinor: price });
  }
  return out;
};

export const optimize = (session: Session, options: OptimizeOptions): TripPlan[] => {
  const range = options.range ?? { start: session.cycle.start, end: session.cycle.end };

  // Default planning bucket prefers kind="annual"; falls back to the first
  // bucket of any kind. v2.5 introduced kinds so users can keep sick/parental
  // buckets ahead of annual without breaking the planning flow.
  const defaultPlanningBucket =
    session.buckets.find((b) => b.kind === "annual") ?? session.buckets[0];
  const planningBucketId = options.planningBucketId ?? defaultPlanningBucket?.id;
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

  const rawCandidates = generateCandidates(
    session,
    options.holidays,
    options.clock,
    range,
    bucket.id,
  );
  const candidates = annotateCandidates(rawCandidates, session, options.flightInfo);

  const topK = options.topK ?? 5;
  const seedCount = Math.min(Math.max(1, options.seedCount ?? 1), 12);
  const priceAware = options.priceAware === true;

  if (seedCount === 1) {
    return searchTopK(candidates, {
      budget,
      anchors: session.anchors,
      topK,
      priceAware,
      minGapDays: session.minGapDays,
      maxGapDays: session.maxGapDays,
      ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
      ...(options.diversityThreshold !== undefined
        ? { diversityThreshold: options.diversityThreshold }
        : {}),
    });
  }

  // Multi-seed: partition the cycle into seedCount start-day segments and run
  // a constrained search per segment that forces the first trip's departure
  // to fall within that segment. Each segment's search runs against ONLY its
  // segment's candidates (a deliberate approximation — see ADR 0007 for the
  // tradeoff). We round-robin-merge so every segment contributes to top-K.
  const cycleLen = range.end - range.start + 1;
  const perSegmentPlans: TripPlan[][] = [];

  for (let s = 0; s < seedCount; s++) {
    const segStart = range.start + Math.floor((cycleLen * s) / seedCount);
    const segEnd =
      s === seedCount - 1
        ? range.end
        : range.start + Math.floor((cycleLen * (s + 1)) / seedCount) - 1;

    const segCandidates = candidates.filter(
      (c) => c.trip.departure >= segStart && c.trip.departure <= segEnd,
    );
    if (segCandidates.length === 0) {
      perSegmentPlans.push([]);
      continue;
    }

    const plans = searchTopK(segCandidates, {
      budget,
      anchors: session.anchors,
      topK,
      priceAware,
      minGapDays: session.minGapDays,
      maxGapDays: session.maxGapDays,
      ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
    });
    perSegmentPlans.push(plans);
  }

  // Round-robin merge: take plan #1 from each segment, then #2, etc., until
  // top-K is filled. Guarantees every non-empty segment contributes at least
  // one plan when K >= seedCount, producing the cross-cluster diversity we
  // came here for. Within a "round", segments contribute in score-descending
  // order so the highest-scoring plan still goes first.
  const merged: TripPlan[] = [];
  const cursors = perSegmentPlans.map(() => 0);
  while (merged.length < topK) {
    const segmentsWithMore = perSegmentPlans
      .map((plans, i) => ({ i, plan: plans[cursors[i]!] }))
      .filter((x) => x.plan !== undefined);
    if (segmentsWithMore.length === 0) break;
    segmentsWithMore.sort((a, b) =>
      compareScores(scorePlan(a.plan!, priceAware), scorePlan(b.plan!, priceAware)),
    );
    for (const { i, plan } of segmentsWithMore) {
      if (merged.length === topK) break;
      merged.push(plan!);
      cursors[i]!++;
    }
  }

  return merged;
};

export { type TripPlan } from "./plan.js";
export { type PlanScore, scorePlan, compareScores } from "./score.js";
export { type Candidate, generateCandidates } from "./candidates.js";
export { type SearchOptions, searchTopK } from "./search.js";
export { planSimilarity } from "./diversity.js";
