import type { DayInt } from "../calendar/day-int.js";
import type { Session } from "../session/session.js";
import { computeTripCost } from "../trips/cost.js";

import { type LeaveCycle } from "./cycle.js";

export type Balance = {
  total: number;
  consumed: number;
  remaining: number;
  buffer: number;
  available: number;
};

export type BalanceArgs = {
  bucketTotal: number;
  consumed: number;
  cycle: LeaveCycle;
  carryoverFromPrev?: number;
};

export const computeBalance = ({
  bucketTotal,
  consumed,
  cycle,
  carryoverFromPrev = 0,
}: BalanceArgs): Balance => {
  if (consumed < 0) throw new RangeError("consumed must be >= 0");

  const carryover =
    cycle.carryover.mode === "cumulative"
      ? Math.min(carryoverFromPrev, cycle.carryover.maxDays)
      : 0;
  const total = bucketTotal + carryover;

  if (consumed > total) throw new RangeError("consumed must not exceed total");

  const remaining = total - consumed;
  const available = Math.max(0, remaining - cycle.bufferAtEnd);

  return { total, consumed, remaining, buffer: cycle.bufferAtEnd, available };
};

export type BucketBalance = {
  readonly bucketId: string;
  readonly bucketName: string;
  readonly balance: Balance;
};

export const computeBucketBalances = (
  session: Session,
  holidays: ReadonlySet<DayInt>,
): ReadonlyArray<BucketBalance> => {
  const consumedByBucket = new Map<string, number>();
  for (const trip of session.trips) {
    if (!trip.isActual) continue;
    const cost = computeTripCost(trip, session, holidays).leaveCost;
    consumedByBucket.set(trip.bucketId, (consumedByBucket.get(trip.bucketId) ?? 0) + cost);
  }

  return session.buckets.map((bucket) => ({
    bucketId: bucket.id,
    bucketName: bucket.name,
    balance: computeBalance({
      bucketTotal: bucket.totalDays,
      consumed: consumedByBucket.get(bucket.id) ?? 0,
      cycle: session.cycle,
    }),
  }));
};
