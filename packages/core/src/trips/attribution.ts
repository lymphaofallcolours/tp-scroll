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

const defaultRuleFor = (
  day: DayInt,
  trip: Trip,
  session: Session,
  holidays: ReadonlySet<DayInt>,
): DefaultRule => {
  const isDepartureDay = day === trip.departure;
  const isReturnDay = day === trip.return;
  const isTravelEdge = isDepartureDay || isReturnDay;

  if (isTravelEdge) {
    if (session.departureMode === "last-home-day") {
      return {
        location: "residence",
        isTravelDay: true,
        consumesLeave: session.travelDayConsumesLeaveByDefault,
      };
    }
    return {
      location: "transit",
      isTravelDay: true,
      consumesLeave: session.travelDayConsumesLeaveByDefault,
    };
  }

  const isResWeekend = isWeekend(day, session.residenceCountry);
  const isHoliday = holidays.has(day);
  const consumesLeave = (() => {
    if (isHoliday) return false;
    if (isResWeekend && !session.cycle.countWeekends) return false;
    return true;
  })();

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
