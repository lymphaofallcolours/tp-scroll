import type { TripPlan } from "./plan.js";

export type PlanScore =
  | readonly [number, number, number, number]
  | readonly [number, number, number, number, number];

const LEVERAGE_SCALE = 10_000;

export const scorePlan = (plan: TripPlan, priceAware = false): PlanScore => {
  const leverage =
    plan.leaveCostTotal === 0
      ? Number.POSITIVE_INFINITY
      : Math.round((plan.awayDaysTotal / plan.leaveCostTotal) * LEVERAGE_SCALE);
  const base: readonly [number, number, number, number] = [
    plan.awayDaysTotal,
    leverage,
    plan.anchorCoverage,
    plan.tripCount,
  ];
  if (!priceAware) return base;
  // Price as 5th tier — lower is better, so we use the negative so the same
  // "higher wins" comparator works on the whole tuple. Missing price is
  // scored as 0 (neutral); see ADR 0010.
  const priceScore = plan.priceTotalMinor === undefined ? 0 : -plan.priceTotalMinor;
  return [base[0], base[1], base[2], base[3], priceScore];
};

export const compareScores = (a: PlanScore, b: PlanScore): number => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai === bi) continue;
    if (ai === Number.POSITIVE_INFINITY) return -1;
    if (bi === Number.POSITIVE_INFINITY) return 1;
    return bi - ai;
  }
  return 0;
};
