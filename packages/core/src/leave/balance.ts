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
