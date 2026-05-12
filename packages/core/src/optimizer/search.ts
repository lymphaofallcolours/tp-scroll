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
  /**
   * Reserved for future use. Currently only exact-duplicate trip-sets are
   * deduplicated; cross-cluster diversity needs a different search architecture
   * (see memory_docs/plans/v0.3.md).
   */
  readonly diversityThreshold?: number;
};

const DEFAULT_MAX_NODES = 200_000;
const DEFAULT_MAX_CANDIDATES = 800;

const capCandidates = (candidates: Candidate[], cap: number): Candidate[] => {
  if (candidates.length <= cap) return candidates;
  const ranked = [...candidates].sort((a, b) => leverage(b) - leverage(a));
  return ranked.slice(0, cap);
};

const leverage = (c: Candidate): number =>
  c.leaveCost === 0 ? Number.POSITIVE_INFINITY : c.awayDays / c.leaveCost;

const tripSetKey = (plan: TripPlan): string =>
  plan.trips
    .map((t) => `${t.departure}-${t.return}`)
    .sort()
    .join("|");

export const searchTopK = (candidates: Candidate[], options: SearchOptions): TripPlan[] => {
  const capped = capCandidates(candidates, options.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const sorted = [...capped].sort((a, b) => a.trip.departure - b.trip.departure);

  const nextNonOverlap = sorted.map((c, i) => {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.trip.departure <= c.trip.return) j++;
    return j;
  });

  // LP-relaxation (fractional knapsack) upper bound on additional awayDays
  // achievable from candidates[i..] under budgetLeft. Walks candidates in
  // leverage-descending order, accumulating awayDays; the boundary candidate
  // contributes a fractional share. Always ≥ true integer optimum and tighter
  // than the v0.2 sum-of-affordable form.
  const leverageOrder = [...sorted.keys()].sort(
    (a, b) => leverage(sorted[b]!) - leverage(sorted[a]!),
  );

  const remainingBoundFor = (i: number, budgetLeft: number): number => {
    let bound = 0;
    let budgetUsed = 0;
    for (const idx of leverageOrder) {
      if (idx < i) continue;
      const c = sorted[idx]!;
      const remaining = budgetLeft - budgetUsed;
      if (remaining <= 0) break;
      if (c.leaveCost <= remaining) {
        bound += c.awayDays;
        budgetUsed += c.leaveCost;
      } else if (c.leaveCost > 0) {
        bound += (remaining / c.leaveCost) * c.awayDays;
        break;
      }
    }
    return bound;
  };

  const baselineAnchor = anchorCoverageScore(options.anchors, () => false);
  const k = Math.max(1, options.topK);
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;

  const topK: TripPlan[] = [];
  const seenTripSets = new Set<string>();

  const planFromPicked = (picked: ReadonlyArray<Candidate>): TripPlan => ({
    trips: picked.map((c) => c.trip),
    leaveCostTotal: picked.reduce((s, c) => s + c.leaveCost, 0),
    awayDaysTotal: picked.reduce((s, c) => s + c.awayDays, 0),
    anchorCoverage: baselineAnchor + picked.reduce((s, c) => s + c.anchorDelta, 0),
    tripCount: picked.length,
  });

  const considerPlan = (plan: TripPlan): void => {
    // Exact-duplicate trip-sets are skipped — they only differ by candidate id,
    // which is internal noise.
    const key = tripSetKey(plan);
    if (seenTripSets.has(key)) return;

    const score = scorePlan(plan);
    if (topK.length < k) {
      seenTripSets.add(key);
      topK.push(plan);
      topK.sort((a, b) => compareScores(scorePlan(a), scorePlan(b)));
      return;
    }
    const worst = topK[topK.length - 1]!;
    if (compareScores(score, scorePlan(worst)) < 0) {
      seenTripSets.delete(tripSetKey(worst));
      seenTripSets.add(key);
      topK[topK.length - 1] = plan;
      topK.sort((a, b) => compareScores(scorePlan(a), scorePlan(b)));
    }
  };

  let nodes = 0;
  const picked: Candidate[] = [];

  const explore = (i: number, budgetLeft: number, awayDaysSoFar: number): void => {
    if (++nodes > maxNodes) return;
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

// Re-exported for tests that want to introspect plan-set similarity directly.
export { planSimilarity };
