import { z } from "zod";

const DayIntSchema = z.number().int();

/**
 * A named time window where the optimizer's per-trip bounds are temporarily
 * relaxed (or tightened). For example: "summer break — allow trips up to 30
 * days" or "exam season — minimum 5-day trips only".
 *
 * Region overrides are sparse: any unset field falls back to the session-level
 * value. A candidate trip's start day is what decides which region it belongs
 * to (so a 14-day trip starting 1 day before the region ends still uses the
 * region's bounds — by design, since the trip is "of" that period).
 *
 * Gap bounds and flight constraints are NOT yet region-scoped; both apply
 * globally. We'll extend if a real need shows up.
 */
export const RegionOverrideSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    start: DayIntSchema,
    end: DayIntSchema,
    minTripDays: z.number().int().positive().optional(),
    maxTripDays: z.number().int().positive().optional(),
  })
  .refine((r) => r.end >= r.start, { message: "end must be >= start" })
  .refine(
    (r) =>
      r.minTripDays === undefined ||
      r.maxTripDays === undefined ||
      r.minTripDays <= r.maxTripDays,
    { message: "minTripDays must be <= maxTripDays" },
  );

export type RegionOverride = z.infer<typeof RegionOverrideSchema>;

/**
 * Find the region whose [start, end] covers `day`, if any. Returns the first
 * match — overlapping regions are tolerated but ambiguous; UI should warn.
 */
export const regionForDay = (
  regions: ReadonlyArray<RegionOverride>,
  day: number,
): RegionOverride | undefined =>
  regions.find((r) => day >= r.start && day <= r.end);
