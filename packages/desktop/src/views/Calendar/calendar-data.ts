import { Temporal } from "@js-temporal/polyfill";

import {
  fromDayInt,
  isWeekend,
  type BucketKind,
  type DayInt,
  type Session,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

export type DayKind =
  | "blank"
  | "residence"
  | "weekend"
  | "holiday"
  | "blocked"
  | "trip-actual"
  | "trip-planned";

export type DayCell = {
  readonly day: DayInt;
  readonly date: Temporal.PlainDate;
  readonly kind: DayKind;
  /** The bucket kind the trip is charged to (when kind is trip-*). */
  readonly bucketKind?: BucketKind;
  readonly label?: string;
};

export type MonthView = {
  readonly year: number;
  readonly month: number; // 1-12
  readonly weeks: ReadonlyArray<ReadonlyArray<DayCell | null>>; // 6 weeks × 7 days, null = padding
};

/**
 * Build a 12-month view (Jan–Dec of the cycle's start year) where each day
 * is classified into a `DayKind`. The most specific classification wins:
 * trip-planned > trip-actual > blocked > holiday > weekend > residence > blank.
 */
export const buildYearView = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): ReadonlyArray<MonthView> => {
  const startDate = fromDayInt(session.cycle.start);
  const year = startDate.year;

  const holidaySet = new Set(holidays.map((h) => h.day));
  const trips = session.trips;
  const blocked = session.blocked;

  const bucketKindFor = (bucketId: string): BucketKind | undefined =>
    session.buckets.find((b) => b.id === bucketId)?.kind;

  const classify = (
    day: DayInt,
    date: Temporal.PlainDate,
  ): { kind: DayKind; bucketKind?: BucketKind } => {
    if (date.year !== year) return { kind: "blank" };

    const inTrip = trips.find((t) => day >= t.departure && day <= t.return);
    if (inTrip) {
      const bk = bucketKindFor(inTrip.bucketId);
      return {
        kind: inTrip.isActual ? "trip-actual" : "trip-planned",
        ...(bk !== undefined ? { bucketKind: bk } : {}),
      };
    }

    if (blocked.some((b) => day >= b.start && day <= b.end)) return { kind: "blocked" };
    if (holidaySet.has(day)) return { kind: "holiday" };
    if (isWeekend(day, session.residenceCountry)) return { kind: "weekend" };
    return { kind: "residence" };
  };

  return Array.from({ length: 12 }, (_, mIdx) => {
    const month = mIdx + 1;
    const first = Temporal.PlainDate.from({ year, month, day: 1 });
    const dim = first.daysInMonth;
    // Monday-first week (ISO). 1 = Mon ... 7 = Sun.
    const startWeekday = first.dayOfWeek;
    const leading = startWeekday - 1;

    // 6 rows × 7 cols, padded with nulls.
    const cells: (DayCell | null)[] = Array(42).fill(null);
    for (let d = 1; d <= dim; d++) {
      const date = first.with({ day: d });
      const dayInt = (() => {
        const epoch = Temporal.PlainDate.from("2000-01-01");
        return epoch.until(date, { largestUnit: "days" }).days;
      })();
      const classification = classify(dayInt, date);
      cells[leading + d - 1] = {
        day: dayInt,
        date,
        kind: classification.kind,
        ...(classification.bucketKind !== undefined ? { bucketKind: classification.bucketKind } : {}),
      };
    }

    const weeks: (DayCell | null)[][] = [];
    for (let w = 0; w < 6; w++) {
      weeks.push(cells.slice(w * 7, w * 7 + 7));
    }

    return { year, month, weeks };
  });
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;
