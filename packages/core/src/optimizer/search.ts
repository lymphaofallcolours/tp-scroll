import { anchorCoverageScore, type AnchorDate } from "../constraints/anchor.js";

import type { Candidate } from "./candidates.js";
import type { TripPlan } from "./plan.js";
import { compareScores, scorePlan } from "./score.js";

export type SearchOptions = {
  readonly budget: number;
  readonly anchors: ReadonlyArray<AnchorDate>;
  readonly topK: number;
  readonly maxNodes?: number;
  readonly maxCandidates?: number;
};

const DEFAULT_MAX_NODES = 200_000;
const DEFAULT_MAX_CANDIDATES = 800;

// Keep the highest-leverage candidates when over the cap, keeping a diversity
// of start days so the search isn't biased to one region.
const capCandidates = (candidates: Candidate[], cap: number): Candidate[] => {
  if (candidates.length <= cap) return candidates;
  const ranked = [...candidates].sort((a, b) => leverage(b) - leverage(a));
  return ranked.slice(0, cap);
};

const leverage = (c: Candidate): number =>
  c.leaveCost === 0 ? Number.POSITIVE_INFINITY : c.awayDays / c.leaveCost;

export const searchTopK = (candidates: Candidate[], options: SearchOptions): TripPlan[] => {
  const capped = capCandidates(candidates, options.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const sorted = [...capped].sort((a, b) => a.trip.departure - b.trip.departure);

  const nextNonOverlap = sorted.map((c, i) => {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.trip.departure <= c.trip.return) j++;
    return j;
  });

  // Loose upper bound on additional awayDays from candidates[i..] under budget.
  const remainingBoundFor = (i: number, budgetLeft: number): number => {
    let bound = 0;
    for (let k = i; k < sorted.length; k++) {
      if (sorted[k]!.leaveCost <= budgetLeft) bound += sorted[k]!.awayDays;
    }
    return bound;
  };

  const baselineAnchor = anchorCoverageScore(options.anchors, () => false);
  const k = Math.max(1, options.topK);
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const topK: TripPlan[] = [];

  const planFromPicked = (picked: ReadonlyArray<Candidate>): TripPlan => ({
    trips: picked.map((c) => c.trip),
    leaveCostTotal: picked.reduce((s, c) => s + c.leaveCost, 0),
    awayDaysTotal: picked.reduce((s, c) => s + c.awayDays, 0),
    anchorCoverage: baselineAnchor + picked.reduce((s, c) => s + c.anchorDelta, 0),
    tripCount: picked.length,
  });

  const considerPlan = (plan: TripPlan): void => {
    const score = scorePlan(plan);
    if (topK.length < k) {
      topK.push(plan);
      topK.sort((a, b) => compareScores(scorePlan(a), scorePlan(b)));
      return;
    }
    const worst = topK[topK.length - 1]!;
    if (compareScores(score, scorePlan(worst)) < 0) {
      topK[topK.length - 1] = plan;
      topK.sort((a, b) => compareScores(scorePlan(a), scorePlan(b)));
    }
  };

  let nodes = 0;
  const picked: Candidate[] = [];

  // Take-only recursion: depth bounded by number of trips, not number of candidates.
  const explore = (i: number, budgetLeft: number, awayDaysSoFar: number): void => {
    if (++nodes > maxNodes) return;

    // Every reachable node is a complete plan candidate (the "skip everything from i" plan).
    considerPlan(planFromPicked(picked));

    if (topK.length >= k) {
      const upper = awayDaysSoFar + remainingBoundFor(i, budgetLeft);
      if (upper < topK[topK.length - 1]!.awayDaysTotal) return;
    }

    for (let j = i; j < sorted.length; j++) {
      if (nodes > maxNodes) return;
      const c = sorted[j]!;
      if (c.leaveCost > budgetLeft) continue;
      picked.push(c);
      explore(nextNonOverlap[j]!, budgetLeft - c.leaveCost, awayDaysSoFar + c.awayDays);
      picked.pop();
    }
  };

  explore(0, options.budget, 0);

  return topK;
};
