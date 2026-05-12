import { type DayInt } from "../calendar/day-int.js";
import { type Session } from "../session/session.js";

import { resolveAttribution } from "./attribution.js";
import { type Trip } from "./trip.js";

export type TripCost = {
  readonly leaveCost: number;
  readonly awayDays: number;
  readonly travelDays: number;
};

export const computeTripCost = (
  trip: Trip,
  session: Session,
  holidays: ReadonlySet<DayInt>,
): TripCost => {
  let leaveCost = 0;
  let awayDays = 0;
  let travelDays = 0;

  for (const r of resolveAttribution(trip, session, holidays)) {
    if (r.consumesLeave) leaveCost++;
    if (r.location !== "residence") awayDays++;
    if (r.isTravelDay) travelDays++;
  }

  return { leaveCost, awayDays, travelDays };
};
