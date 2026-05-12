import type { Clock } from "../calendar/clock.js";
import type { DayInt } from "../calendar/day-int.js";
import { type DayRange, overlaps } from "../calendar/range.js";
import {
  anchorSatisfied,
  type AnchorDate,
  respectsBookingHorizon,
  tripOverlapsBlocked,
} from "../constraints/index.js";
import type { Session } from "../session/session.js";
import { resolveAttribution } from "../trips/attribution.js";
import { computeTripCost } from "../trips/cost.js";
import type { Trip } from "../trips/trip.js";

export type Candidate = {
  readonly trip: Trip;
  readonly leaveCost: number;
  readonly awayDays: number;
  readonly anchorDelta: number;
  /**
   * Outbound + inbound priceMinor for this candidate's trip, when the
   * caller supplied flightInfo. Used by the price-aware scorer in v1.7.
   */
  readonly priceMinor?: number;
};

export const generateCandidates = (
  session: Session,
  holidays: ReadonlySet<DayInt>,
  clock: Clock,
  searchRange: DayRange,
  bucketId: string,
): Candidate[] => {
  const out: Candidate[] = [];
  const baseRange: DayRange = {
    start: Math.max(searchRange.start, session.cycle.start),
    end: Math.min(searchRange.end, session.cycle.end),
  };

  for (let start = baseRange.start; start <= baseRange.end; start++) {
    for (let length = session.minTripDays; length <= session.maxTripDays; length++) {
      const end = start + length - 1;
      if (end > baseRange.end) break;

      const trip: Trip = {
        id: `cand-${start}-${length}`,
        departure: start,
        return: end,
        bucketId,
        isActual: false,
        dayOverrides: [],
      };

      if (session.blocked.some((b) => tripOverlapsBlocked(trip, b))) continue;
      if (!respectsBookingHorizon(trip, session.cycle, clock)) continue;
      if (
        session.trips.some((t) =>
          overlaps({ start: trip.departure, end: trip.return }, { start: t.departure, end: t.return }),
        )
      ) {
        continue;
      }

      const cost = computeTripCost(trip, session, holidays);
      out.push({
        trip,
        leaveCost: cost.leaveCost,
        awayDays: cost.awayDays,
        anchorDelta: anchorDeltaFor(trip, session, holidays, session.anchors),
      });
    }
  }

  return out;
};

const anchorDeltaFor = (
  trip: Trip,
  session: Session,
  holidays: ReadonlySet<DayInt>,
  anchors: ReadonlyArray<AnchorDate>,
): number => {
  if (anchors.length === 0) return 0;
  const locationByDay = new Map<DayInt, "residence" | "home" | "transit">();
  for (const r of resolveAttribution(trip, session, holidays)) locationByDay.set(r.day, r.location);
  const isAtHomeIfCovered = (day: DayInt): boolean | undefined => {
    const loc = locationByDay.get(day);
    return loc === undefined ? undefined : loc !== "residence";
  };
  let delta = 0;
  for (const a of anchors) {
    const cov = isAtHomeIfCovered(a.day);
    if (cov === undefined) continue;
    // Compare: default (no trip) treats day as residence (isAtHome=false).
    // Switching to "covered with cov" flips satisfaction.
    const defaultSatisfied = anchorSatisfied(a, () => false);
    const newSatisfied = anchorSatisfied(a, () => cov);
    if (defaultSatisfied === newSatisfied) continue;
    delta += newSatisfied ? a.weight : -a.weight;
  }
  return delta;
};
