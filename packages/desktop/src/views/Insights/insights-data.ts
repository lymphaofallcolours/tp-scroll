import {
  bucketKindColor,
  computeBucketBalances,
  computeTripCost,
  currentSchengenLoad,
  fromDayInt,
  isoFromDayInt,
  isSchengen,
  isWeekend,
  resolveAttribution,
  type BucketKind,
  type DayInt,
  type Session,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

export type BurndownSeries = {
  readonly labels: ReadonlyArray<string>;
  readonly actuals: ReadonlyArray<number>;
  readonly projected: ReadonlyArray<number>;
  readonly budget: number;
  readonly buffer: number;
};

/**
 * For each day in the cycle, compute cumulative leave-cost from actual trips
 * (solid line) and from actual + planned trips (dashed projection). The trip's
 * cost is charged on its return day — that's when leave is "spent". Both
 * series are downsampled to weekly granularity for chart readability.
 */
export const buildBurndown = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): BurndownSeries => {
  const holidaySet = new Set(holidays.map((h) => h.day));

  const charges = session.trips.map((t) => ({
    on: t.return,
    cost: computeTripCost(t, session, holidaySet).leaveCost,
    isActual: t.isActual,
  }));

  const labels: string[] = [];
  const actuals: number[] = [];
  const projected: number[] = [];

  let actualSum = 0;
  let projectedSum = 0;

  for (let d: DayInt = session.cycle.start; d <= session.cycle.end; d++) {
    for (const c of charges) {
      if (c.on === d) {
        if (c.isActual) actualSum += c.cost;
        projectedSum += c.cost;
      }
    }
    if (
      d === session.cycle.start ||
      d === session.cycle.end ||
      (d - session.cycle.start) % 7 === 0
    ) {
      labels.push(isoFromDayInt(d));
      actuals.push(actualSum);
      projected.push(projectedSum);
    }
  }

  return {
    labels,
    actuals,
    projected,
    budget: session.cycle.totalDays,
    buffer: session.cycle.bufferAtEnd,
  };
};

export type BucketSlice = {
  readonly bucketId: string;
  readonly bucketName: string;
  readonly kind: BucketKind;
  readonly consumed: number;
  readonly remaining: number;
  readonly total: number;
  readonly colorVar: string;
};

/**
 * Per-bucket consumption breakdown. Drives the bucket donut chart. Numbers
 * come straight from computeBucketBalances so the donut and the calendar
 * "Consumed/Remaining" widgets never disagree.
 */
export const buildBucketSlices = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): ReadonlyArray<BucketSlice> => {
  const holidaySet = new Set(holidays.map((h) => h.day));
  const balances = computeBucketBalances(session, holidaySet);
  return balances.map((b) => {
    const bucket = session.buckets.find((sb) => sb.id === b.bucketId);
    return {
      bucketId: b.bucketId,
      bucketName: bucket?.name ?? b.bucketId,
      kind: bucket?.kind ?? "annual",
      consumed: b.balance.consumed,
      remaining: b.balance.remaining,
      total: b.balance.consumed + b.balance.remaining,
      colorVar: bucketKindColor(bucket?.kind ?? "annual"),
    };
  });
};

export type AnchorRow = {
  readonly day: DayInt;
  readonly iso: string;
  readonly weekday: string;
  readonly preferIn: "home" | "residence";
  readonly weight: number;
  readonly satisfied: boolean;
  readonly explanation: string;
};

/**
 * For each anchor, compute whether the current set of trips satisfies it.
 * "Satisfied" means the user is in the preferred location on that day —
 * derived from each trip's per-day attribution (location: residence / home /
 * transit).
 */
export const buildAnchorRows = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): ReadonlyArray<AnchorRow> => {
  const holidaySet = new Set(holidays.map((h) => h.day));
  const locationByDay = new Map<DayInt, "residence" | "home" | "transit">();
  for (const trip of session.trips) {
    if (!trip.isActual) continue;
    for (const r of resolveAttribution(trip, session, holidaySet)) {
      locationByDay.set(r.day, r.location);
    }
  }
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return session.anchors
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((a) => {
      const loc = locationByDay.get(a.day) ?? "residence";
      const atHome = loc !== "residence";
      const satisfied = a.preferIn === "home" ? atHome : !atHome;
      const date = fromDayInt(a.day);
      const explanation = satisfied
        ? `you're in ${loc} on this day, which matches preferIn=${a.preferIn}`
        : `you're in ${loc} on this day, but you prefer ${a.preferIn}`;
      return {
        day: a.day,
        iso: isoFromDayInt(a.day),
        weekday: dayNames[date.dayOfWeek - 1] ?? "—",
        preferIn: a.preferIn,
        weight: a.weight,
        satisfied,
        explanation,
      };
    });
};

export type TripLengthBin = {
  readonly label: string;
  readonly count: number;
};

/**
 * Histogram of trip durations. Bins are tuned for typical leave usage:
 * 1d (day trips), 2-3d (weekend escapes), 4-7d (workweeks), 8-14d (real
 * holidays), 15+d (long trips). Counts only actual trips; planned trips are
 * shown separately on the calendar.
 */
export const buildTripLengthHistogram = (
  session: Session,
): ReadonlyArray<TripLengthBin> => {
  const bins = [
    { label: "1d", min: 1, max: 1, count: 0 },
    { label: "2-3d", min: 2, max: 3, count: 0 },
    { label: "4-7d", min: 4, max: 7, count: 0 },
    { label: "8-14d", min: 8, max: 14, count: 0 },
    { label: "15+d", min: 15, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  for (const t of session.trips) {
    if (!t.isActual) continue;
    const len = t.return - t.departure + 1;
    const bin = bins.find((b) => len >= b.min && len <= b.max);
    if (bin) bin.count += 1;
  }
  return bins.map((b) => ({ label: b.label, count: b.count }));
};

export type LeverageStats = {
  readonly leaveDays: number;
  readonly awayDays: number;
  readonly freeDays: number;
  readonly leveragePct: number;
};

/**
 * Across all trips (actual + planned), how many away-days were "free" —
 * not charged to a leave-day (weekends, holidays, or day-overrides).
 * Reported as a percentage of total away-days so a single number tells the
 * full story.
 */
export const buildLeverageStats = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): LeverageStats => {
  const holidaySet = new Set(holidays.map((h) => h.day));
  let leaveDays = 0;
  let awayDays = 0;
  for (const t of session.trips) {
    const cost = computeTripCost(t, session, holidaySet);
    leaveDays += cost.leaveCost;
    awayDays += cost.awayDays;
  }
  const freeDays = Math.max(0, awayDays - leaveDays);
  const leveragePct = awayDays === 0 ? 0 : Math.round((freeDays / awayDays) * 100);
  return { leaveDays, awayDays, freeDays, leveragePct };
};

export type MonthlyBucket = {
  readonly label: string; // "Jan", "Feb", ...
  readonly month: number; // 1-12
  readonly home: number;
  readonly away: number;
  readonly weekend: number;
  readonly holiday: number;
  readonly blocked: number;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Per-month breakdown of every day in the cycle. Each day belongs to exactly
 * one bucket so the stacked-bar columns always sum to the days-in-month
 * (or the slice of the month inside the cycle if it straddles).
 *
 * Precedence: trip → blocked → holiday → weekend → home (residence).
 */
export const buildMonthlyDistribution = (
  session: Session,
  holidays: ReadonlyArray<Holiday>,
): ReadonlyArray<MonthlyBucket> => {
  const holidayByDay = new Map(holidays.map((h) => [h.day, h.name]));
  const tripByDay = new Map<DayInt, "actual" | "planned">();
  for (const t of session.trips) {
    for (let d = t.departure; d <= t.return; d++) {
      tripByDay.set(d, t.isActual ? "actual" : "planned");
    }
  }
  const blockedByDay = new Set<DayInt>();
  for (const b of session.blocked) {
    for (let d = b.start; d <= b.end; d++) blockedByDay.add(d);
  }

  const startYear = fromDayInt(session.cycle.start).year;
  type Mutable = { -readonly [K in keyof MonthlyBucket]: MonthlyBucket[K] };
  const buckets: Mutable[] = MONTH_LABELS.map((label, i) => ({
    label,
    month: i + 1,
    home: 0,
    away: 0,
    weekend: 0,
    holiday: 0,
    blocked: 0,
  }));

  for (let d = session.cycle.start; d <= session.cycle.end; d++) {
    const date = fromDayInt(d);
    if (date.year !== startYear) continue;
    const m = date.month - 1;
    const bucket = buckets[m]!;
    if (tripByDay.has(d)) bucket.away += 1;
    else if (blockedByDay.has(d)) bucket.blocked += 1;
    else if (holidayByDay.has(d)) bucket.holiday += 1;
    else if (isWeekend(d, session.residenceCountry)) bucket.weekend += 1;
    else bucket.home += 1;
  }

  return buckets;
};

export type SchengenSnapshot = {
  readonly applicable: boolean;
  readonly residenceOutside: boolean;
  readonly homeOutside: boolean;
  readonly windowDays: number;
  readonly maxDays: number;
  readonly daysUsed: number;
  readonly today: DayInt;
};

/**
 * Snapshot of the Schengen 90/180 counter at "today". Only meaningful when
 * the user has at least one foot outside Schengen; if both residence and
 * home are Schengen-area, the panel switches to a "not applicable" state
 * rather than reporting 0/90.
 */
export const buildSchengenSnapshot = (
  session: Session,
  today: DayInt,
): SchengenSnapshot => {
  const residenceOutside = !isSchengen(session.residenceCountry);
  const homeOutside = !isSchengen(session.homeCountry);
  const applicable = residenceOutside || homeOutside;
  const windowDays = 180;
  const maxDays = 90;
  const daysUsed = applicable
    ? currentSchengenLoad({
        trips: session.trips,
        residenceCountry: session.residenceCountry,
        homeCountry: session.homeCountry,
        today,
        windowDays,
        session,
      })
    : 0;
  return { applicable, residenceOutside, homeOutside, windowDays, maxDays, daysUsed, today };
};
