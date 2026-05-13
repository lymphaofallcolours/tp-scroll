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
  /**
   * When true, plans carry a `priceTotalMinor` summed from candidate prices,
   * and the lexicographic scorer adds a 5th tier (lower price wins among
   * ties on the existing 4 tiers). Requires candidates' `priceMinor` set.
   */
  readonly priceAware?: boolean;
  /**
   * Minimum calendar days strictly between consecutive picked trips
   * (gap = next.departure - prev.return - 1). 0 = allow back-to-back.
   * Only applies between consecutive trips, not to cycle boundaries.
   */
  readonly minGapDays?: number;
  /**
   * Maximum calendar days strictly between consecutive picked trips. The
   * optimizer prunes branches that would force a longer gap than this.
   * A large default (e.g. 365) effectively disables the constraint.
   */
  readonly maxGapDays?: number;
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


export const searchTopK = (candidates: Candidate[], options: SearchOptions): TripPlan[] => {
  const capped = capCandidates(candidates, options.maxCandidates ?? DEFAULT_MAX_CANDIDATES);
  const sorted = [...capped].sort((a, b) => a.trip.departure - b.trip.departure);

  const nextNonOverlap = sorted.map((c, i) => {
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.trip.departure <= c.trip.return) j++;
    return j;
  });

  // Upper bound on additional awayDays achievable from candidates[i..] under
  // budgetLeft. Sums the awayDays of every candidate in the [i..end] slice
  // whose individual leaveCost fits — loose (over-counts when chosen candidates
  // would overlap or compete for the same budget) but O(N - i) per call. The
  // earlier v0.3 attempt at an LP-relaxation walk over a global leverage-sorted
  // index was O(N) regardless of depth, which slowed deep search significantly.
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
  const priceAware = options.priceAware === true;
  const minGap = Math.max(0, options.minGapDays ?? 0);
  const maxGap = Math.max(minGap, options.maxGapDays ?? Number.POSITIVE_INFINITY);

  const topK: TripPlan[] = [];

  const planFromPicked = (picked: ReadonlyArray<Candidate>): TripPlan => {
    const priceTotalMinor = priceAware
      ? picked.reduce<number>((s, c) => s + (c.priceMinor ?? 0), 0)
      : undefined;
    return {
      trips: picked.map((c) => c.trip),
      leaveCostTotal: picked.reduce((s, c) => s + c.leaveCost, 0),
      awayDaysTotal: picked.reduce((s, c) => s + c.awayDays, 0),
      anchorCoverage: baselineAnchor + picked.reduce((s, c) => s + c.anchorDelta, 0),
      tripCount: picked.length,
      ...(priceTotalMinor !== undefined ? { priceTotalMinor } : {}),
    };
  };

  const score = (p: TripPlan) => scorePlan(p, priceAware);

  const considerPlan = (plan: TripPlan): void => {
    const planScore = score(plan);
    if (topK.length < k) {
      topK.push(plan);
      topK.sort((a, b) => compareScores(score(a), score(b)));
      return;
    }
    const worst = topK[topK.length - 1]!;
    if (compareScores(planScore, score(worst)) < 0) {
      topK[topK.length - 1] = plan;
      topK.sort((a, b) => compareScores(score(a), score(b)));
    }
  };

  let nodes = 0;
  const picked: Candidate[] = [];

  const explore = (
    i: number,
    budgetLeft: number,
    awayDaysSoFar: number,
    prevReturn: number | undefined,
  ): void => {
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
      if (prevReturn !== undefined) {
        const gap = c.trip.departure - prevReturn - 1;
        if (gap < minGap) continue;
        // sorted by departure → all subsequent j only increase gap, so break.
        if (gap > maxGap) break;
      }
      picked.push(c);
      explore(
        nextNonOverlap[j]!,
        budgetLeft - c.leaveCost,
        awayDaysSoFar + c.awayDays,
        c.trip.return,
      );
      picked.pop();
    }
  };

  explore(0, options.budget, 0, undefined);

  return topK;
};

// Re-exported for tests that want to introspect plan-set similarity directly.
export { planSimilarity };
