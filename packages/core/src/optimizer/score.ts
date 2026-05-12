import type { TripPlan } from "./plan.js";

export type PlanScore = readonly [number, number, number, number];

const LEVERAGE_SCALE = 10_000;

export const scorePlan = (plan: TripPlan): PlanScore => {
  const leverage =
    plan.leaveCostTotal === 0
      ? Number.POSITIVE_INFINITY
      : Math.round((plan.awayDaysTotal / plan.leaveCostTotal) * LEVERAGE_SCALE);
  return [plan.awayDaysTotal, leverage, plan.anchorCoverage, plan.tripCount];
};

export const compareScores = (a: PlanScore, b: PlanScore): number => {
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai === bi) continue;
    if (ai === Number.POSITIVE_INFINITY) return -1;
    if (bi === Number.POSITIVE_INFINITY) return 1;
    return bi - ai;
  }
  return 0;
};
