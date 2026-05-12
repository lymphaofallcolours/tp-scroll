import { anchorCoverageScore, type AnchorDate } from "../constraints/anchor.js";

import type { Candidate } from "./candidates.js";
import { planSimilarity } from "./diversity.js";
import type { TripPlan } from "./plan.js";
import { compareScores, scorePlan } from "./score.js";

export type SearchOptions = {
  readonly budget: number;
  readonly anchors: ReadonlyArray<AnchorDate>;
  readonly topK: number;
  readonly maxNodes?: number;
  readonly maxCandidates?: number;
  readonly diversityThreshold?: number;
};

const DEFAULT_MAX_NODES = 200_000;
const DEFAULT_MAX_CANDIDATES = 800;
const DEFAULT_DIVERSITY_THRESHOLD = 0.7;
const POOL_MULTIPLIER = 4;
const MIN_POOL_SIZE = 20;

const capCandidates = (candidates: Candidate[], cap: number): Candidate[] => {
  if (candidates.length <= cap) return candidates;
  const ranked = [...candidates].sort((a, b) => leverage(b) - leverage(a));
  return ranked.slice(0, cap);
};

const leverage = (c: Candidate): number =>
  c.leaveCost === 0 ? Number.POSITIVE_INFINITY : c.awayDays / c.leaveCost;

const selectAtThreshold = (
  pool: ReadonlyArray<TripPlan>,
  k: number,
  threshold: number,
): TripPlan[] => {
  const result: TripPlan[] = [];
  for (const cand of pool) {
    if (result.length === k) break;
    const maxSim =
      result.length === 0
        ? 0
        : result.reduce((m, r) => Math.max(m, planSimilarity(cand, r)), 0);
    if (maxSim < threshold) result.push(cand);
  }
  return result;
};

const selectDiverseTopK = (
  pool: ReadonlyArray<TripPlan>,
  k: number,
  startingThreshold: number,
): TripPlan[] => {
  // Try progressively looser thresholds until we hit K. Always picks pool[0]
  // first; subsequent picks are the most-diverse-still-good-by-score plans.
  let threshold = startingThreshold;
  let result = selectAtThreshold(pool, k, threshold);
  while (result.length < k && threshold > 0) {
    threshold = Math.max(0, threshold - 0.1);
    result = selectAtThreshold(pool, k, threshold);
  }
  // Final fallback: fill with best-by-score remainder if even threshold=0 didn't reach K.
  if (result.length < k) {
    for (const p of pool) {
      if (result.length === k) break;
      if (!result.includes(p)) result.push(p);
    }
  }
  return result;
};

export const searchTopK = (candidates: Candidate[], options: SearchOptions): TripPlan[] => {
  const capped = capCandidates(candidates, options.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const sorted = [...capped].sort((a, b) => a.trip.departure - b.trip.departure);

  const nextNonOverlap = sorted.map((c, i) => {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.trip.departure <= c.trip.return) j++;
    return j;
  });

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
  const diversityThreshold = options.diversityThreshold ?? DEFAULT_DIVERSITY_THRESHOLD;
  const poolSize = Math.max(MIN_POOL_SIZE, k * POOL_MULTIPLIER);

  // Pool is maintained UNSORTED during search. We track worstIdx (the
  // lowest-scored entry's array index) to do O(1) worst-replacement.
  // pool[k-1]-by-score for pruning is approximated by a periodically-refreshed
  // kth-best cache. Final sort happens once before MMR selection.
  const pool: TripPlan[] = [];
  const poolKeys = new Set<string>();
  let worstIdx = -1;
  let kthBestAwayDays = -Infinity;

  const tripSetKey = (plan: TripPlan): string =>
    plan.trips
      .map((t) => `${t.departure}-${t.return}`)
      .sort()
      .join("|");

  const planFromPicked = (picked: ReadonlyArray<Candidate>): TripPlan => ({
    trips: picked.map((c) => c.trip),
    leaveCostTotal: picked.reduce((s, c) => s + c.leaveCost, 0),
    awayDaysTotal: picked.reduce((s, c) => s + c.awayDays, 0),
    anchorCoverage: baselineAnchor + picked.reduce((s, c) => s + c.anchorDelta, 0),
    tripCount: picked.length,
  });

  const refreshWorstAndKth = (): void => {
    if (pool.length === 0) {
      worstIdx = -1;
      kthBestAwayDays = -Infinity;
      return;
    }
    let wIdx = 0;
    for (let i = 1; i < pool.length; i++) {
      if (compareScores(scorePlan(pool[i]!), scorePlan(pool[wIdx]!)) > 0) wIdx = i;
    }
    worstIdx = wIdx;
    if (pool.length < k) {
      kthBestAwayDays = -Infinity;
    } else {
      // K-th best by score, single linear partial-sort
      const idxs = pool.map((_, i) => i);
      idxs.sort((a, b) => compareScores(scorePlan(pool[a]!), scorePlan(pool[b]!)));
      kthBestAwayDays = pool[idxs[k - 1]!]!.awayDaysTotal;
    }
  };

  const consider = (plan: TripPlan): void => {
    const key = tripSetKey(plan);
    if (poolKeys.has(key)) return;

    if (pool.length < poolSize) {
      pool.push(plan);
      poolKeys.add(key);
      refreshWorstAndKth();
      return;
    }

    const worst = pool[worstIdx]!;
    if (compareScores(scorePlan(plan), scorePlan(worst)) < 0) {
      poolKeys.delete(tripSetKey(worst));
      pool[worstIdx] = plan;
      poolKeys.add(key);
      refreshWorstAndKth();
    }
  };

  let nodes = 0;
  const picked: Candidate[] = [];

  const pruneThreshold = (): number => kthBestAwayDays;

  const explore = (i: number, budgetLeft: number, awayDaysSoFar: number): void => {
    if (++nodes > maxNodes) return;
    consider(planFromPicked(picked));

    const upper = awayDaysSoFar + remainingBoundFor(i, budgetLeft);
    if (upper < pruneThreshold()) return;

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

  // Single sort at the end before MMR selection.
  pool.sort((a, b) => compareScores(scorePlan(a), scorePlan(b)));
  return selectDiverseTopK(pool, k, diversityThreshold);
};
