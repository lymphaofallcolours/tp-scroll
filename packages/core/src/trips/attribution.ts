import type { DayInt } from "../calendar/day-int.js";
import { isWeekend } from "../calendar/weekend.js";
import { iterate } from "../calendar/range.js";
import type { Session } from "../session/session.js";

import type { Trip } from "./trip.js";

export type ResolvedAttribution = {
  readonly day: DayInt;
  readonly consumesLeave: boolean;
  readonly isTravelDay: boolean;
  readonly halfDay: boolean;
  readonly location: "residence" | "home" | "transit";
};

type DefaultRule = Omit<ResolvedAttribution, "day" | "halfDay">;

// Leave-consumption rule is uniform across every day in a trip: a day
// consumes a leave-day unless it's a public holiday, a residence weekend
// (and `countWeekends` is off), or has been manually overridden. Travel-edge
// days are no longer special-cased on `consumesLeave` — `departureMode` still
// decides their *location* (residence vs transit), which matters for
// Schengen day-counting but never for leave accounting.
const defaultRuleFor = (
  day: DayInt,
  trip: Trip,
  session: Session,
  holidays: ReadonlySet<DayInt>,
): DefaultRule => {
  const isDepartureDay = day === trip.departure;
  const isReturnDay = day === trip.return;
  const isTravelEdge = isDepartureDay || isReturnDay;

  const isResWeekend = isWeekend(day, session.residenceCountry);
  const isHoliday = holidays.has(day);
  const consumesLeave = (() => {
    if (isHoliday) return false;
    if (isResWeekend && !session.cycle.countWeekends) return false;
    return true;
  })();

  if (isTravelEdge) {
    return {
      location: session.departureMode === "last-home-day" ? "residence" : "transit",
      isTravelDay: true,
      consumesLeave,
    };
  }

  return {
    location: "home",
    isTravelDay: false,
    consumesLeave,
  };
};

export const resolveAttribution = (
  trip: Trip,
  session: Session,
  holidays: ReadonlySet<DayInt>,
): ReadonlyArray<ResolvedAttribution> => {
  const overrideMap = new Map(trip.dayOverrides.map((o) => [o.day, o] as const));
  const out: ResolvedAttribution[] = [];

  for (const day of iterate({ start: trip.departure, end: trip.return })) {
    const base = defaultRuleFor(day, trip, session, holidays);
    const override = overrideMap.get(day);
    const halfDayRequested = override?.halfDay === true;
    const halfDay = halfDayRequested && session.cycle.halfDaysAllowed;
    out.push({
      day,
      consumesLeave: override?.consumesLeave ?? base.consumesLeave,
      isTravelDay: override?.isTravelDay ?? base.isTravelDay,
      halfDay,
      location: override?.location ?? base.location,
    });
  }

  return out;
};
