import { type DayInt } from "./day-int.js";

export type DayRange = {
  readonly start: DayInt;
  readonly end: DayInt;
};

export const daysIn = (r: DayRange): number => (r.end < r.start ? 0 : r.end - r.start + 1);

export const overlaps = (a: DayRange, b: DayRange): boolean =>
  a.start <= b.end && b.start <= a.end;

export const intersect = (a: DayRange, b: DayRange): DayRange | null => {
  if (!overlaps(a, b)) return null;
  return { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) };
};

export function* iterate(r: DayRange): Generator<DayInt, void, void> {
  for (let d = r.start; d <= r.end; d++) yield d;
}
