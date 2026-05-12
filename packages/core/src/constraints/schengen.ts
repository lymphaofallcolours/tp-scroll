import { z } from "zod";

import type { DayInt } from "../calendar/day-int.js";
import { type DayRange, iterate } from "../calendar/range.js";
import type { Session } from "../session/session.js";
import { resolveAttribution } from "../trips/attribution.js";
import type { Trip } from "../trips/trip.js";

export const SchengenWatchSchema = z.object({
  enabled: z.boolean(),
  windowDays: z.literal(180),
  maxDaysInWindow: z.literal(90),
});

export type SchengenWatch = z.infer<typeof SchengenWatchSchema>;

// Source: EU Schengen Area membership as of 2026-05. Croatia joined fully in
// 2023; Romania + Bulgaria full land-border accession 2025-01. Switzerland,
// Norway, Iceland, Liechtenstein are non-EU Schengen members.
// Review: re-confirm annually.
export const SCHENGEN_ISO2: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT",
  "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH",
]);

export const isSchengen = (countryCode: string): boolean =>
  SCHENGEN_ISO2.has(countryCode.toUpperCase());

export type SchengenInput = {
  readonly trips: ReadonlyArray<Trip>;
  readonly residenceCountry: string;
  readonly homeCountry: string;
  readonly range: DayRange;
  readonly session: Session;
  readonly watch: SchengenWatch;
};

export type SchengenResult = {
  readonly violatedOn: ReadonlyArray<DayInt>;
  readonly maxInWindow: number;
};

const EMPTY_HOLIDAYS: ReadonlySet<DayInt> = new Set();

export const evaluateSchengenWindow = (input: SchengenInput): SchengenResult => {
  if (!input.watch.enabled) return { violatedOn: [], maxInWindow: 0 };

  const residenceOutside = !isSchengen(input.residenceCountry);
  const homeOutside = !isSchengen(input.homeCountry);

  // Build a per-day map of location across all trips in range
  const tripLocation = new Map<DayInt, "residence" | "home" | "transit">();
  for (const trip of input.trips) {
    for (const r of resolveAttribution(trip, input.session, EMPTY_HOLIDAYS)) {
      tripLocation.set(r.day, r.location);
    }
  }

  const isOutsideOn = (day: DayInt): boolean => {
    const loc = tripLocation.get(day);
    if (loc === undefined) return residenceOutside; // not on a trip → at residence
    if (loc === "residence") return residenceOutside;
    return homeOutside; // home or transit → use homeCountry's status
  };

  const days = [...iterate(input.range)];
  const flags = days.map((d) => (isOutsideOn(d) ? 1 : 0));

  let sum = 0;
  let maxInWindow = 0;
  const violatedOn: DayInt[] = [];
  for (let i = 0; i < days.length; i++) {
    sum += flags[i]!;
    if (i >= input.watch.windowDays) sum -= flags[i - input.watch.windowDays]!;
    if (sum > maxInWindow) maxInWindow = sum;
    if (sum > input.watch.maxDaysInWindow) violatedOn.push(days[i]!);
  }

  return { violatedOn, maxInWindow };
};
