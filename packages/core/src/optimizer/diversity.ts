import type { TripPlan } from "./plan.js";

const tripKeys = (plan: TripPlan): Set<string> =>
  new Set(plan.trips.map((t) => `${t.departure}-${t.return}`));

export const planSimilarity = (a: TripPlan, b: TripPlan): number => {
  const ka = tripKeys(a);
  const kb = tripKeys(b);
  if (ka.size === 0 && kb.size === 0) return 1;
  let intersection = 0;
  for (const k of ka) if (kb.has(k)) intersection++;
  const union = ka.size + kb.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
};
