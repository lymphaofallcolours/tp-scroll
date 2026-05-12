import { type DayInt, fromDayInt } from "./day-int.js";

export type WeekendDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DEFAULT_WEEKEND: ReadonlySet<WeekendDay> = new Set<WeekendDay>([6, 7]);

const COUNTRY_OVERRIDES: Readonly<Record<string, ReadonlySet<WeekendDay>>> = {
  IL: new Set<WeekendDay>([5, 6]),
  AE: new Set<WeekendDay>([6, 7]),
  SA: new Set<WeekendDay>([5, 6]),
  QA: new Set<WeekendDay>([5, 6]),
  KW: new Set<WeekendDay>([5, 6]),
  BH: new Set<WeekendDay>([5, 6]),
  OM: new Set<WeekendDay>([5, 6]),
};

export const weekendDaysFor = (countryCode: string): ReadonlySet<WeekendDay> =>
  COUNTRY_OVERRIDES[countryCode.toUpperCase()] ?? DEFAULT_WEEKEND;

export const isWeekend = (day: DayInt, countryCode: string): boolean => {
  const dayOfWeek = fromDayInt(day).dayOfWeek as WeekendDay;
  return weekendDaysFor(countryCode).has(dayOfWeek);
};
