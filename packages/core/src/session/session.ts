import { z } from "zod";

import { AnchorDateSchema } from "../constraints/anchor.js";
import { BlockedPeriodSchema } from "../constraints/blocked.js";
import { FlightConstraintsSchema } from "../constraints/flight.js";
import { SchengenWatchSchema } from "../constraints/schengen.js";
import { LeaveBucketSchema } from "../leave/bucket.js";
import { LeaveCycleSchema } from "../leave/cycle.js";
import { TripSchema } from "../trips/trip.js";

import { RegionOverrideSchema } from "./region.js";

const DayIntSchema = z.number().int();
const Iso2 = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase());

export const ExtraHolidaySchema = z.object({
  day: DayIntSchema,
  name: z.string().min(1),
});

export const OverriddenHolidaySchema = z.object({
  day: DayIntSchema,
  remove: z.boolean(),
});

export const DepartureModeSchema = z.enum(["last-home-day", "first-away-day"]);
export type DepartureMode = z.infer<typeof DepartureModeSchema>;

export const HistoricalCycleSchema = z.object({
  cycle: LeaveCycleSchema,
  buckets: z.array(LeaveBucketSchema),
  trips: z.array(TripSchema),
  blocked: z.array(BlockedPeriodSchema),
  anchors: z.array(AnchorDateSchema),
  extraHolidays: z.array(ExtraHolidaySchema),
  overriddenHolidays: z.array(OverriddenHolidaySchema),
});

export type HistoricalCycle = z.infer<typeof HistoricalCycleSchema>;

export const SessionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    residenceCountry: Iso2,
    homeCountry: Iso2,
    cycle: LeaveCycleSchema,
    buckets: z.array(LeaveBucketSchema).min(1),
    trips: z.array(TripSchema),
    blocked: z.array(BlockedPeriodSchema),
    anchors: z.array(AnchorDateSchema),
    schengen: SchengenWatchSchema.optional(),
    flightConstraints: FlightConstraintsSchema.optional(),
    extraHolidays: z.array(ExtraHolidaySchema),
    overriddenHolidays: z.array(OverriddenHolidaySchema),
    departureMode: DepartureModeSchema,
    minTripDays: z.number().int().positive(),
    maxTripDays: z.number().int().positive(),
    minGapDays: z.number().int().nonnegative().default(0),
    maxGapDays: z.number().int().nonnegative().default(365),
    regions: z.array(RegionOverrideSchema).default([]),
    // Retained for backwards compat with old session JSON on disk; the
    // value is no longer read by the attribution engine. Travel-edge days
    // now follow the same weekend/holiday/override rule as middle days.
    travelDayConsumesLeaveByDefault: z.boolean().default(true),
    cycleHistory: z.array(HistoricalCycleSchema).default([]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((s) => s.minTripDays <= s.maxTripDays, {
    message: "minTripDays must be <= maxTripDays",
  })
  .refine((s) => s.minGapDays <= s.maxGapDays, {
    message: "minGapDays must be <= maxGapDays",
  })
  .refine(
    (s) =>
      s.cycle.halfDaysAllowed ||
      s.trips.every((t) => t.dayOverrides.every((o) => o.halfDay !== true)),
    {
      message: "half-day overrides require cycle.halfDaysAllowed=true",
    },
  )
  .refine(
    (s) => new Set(s.buckets.map((b) => b.id)).size === s.buckets.length,
    { message: "duplicate bucket ids" },
  )
  .refine(
    (s) => s.buckets.reduce((sum, b) => sum + b.totalDays, 0) === s.cycle.totalDays,
    { message: "bucket totals must sum to cycle.totalDays" },
  )
  .refine(
    (s) => {
      const ids = new Set(s.buckets.map((b) => b.id));
      const missing = s.trips.find((t) => !ids.has(t.bucketId));
      return missing === undefined;
    },
    (s) => {
      const ids = new Set(s.buckets.map((b) => b.id));
      const missing = s.trips.find((t) => !ids.has(t.bucketId));
      return { message: `trip references unknown bucket: ${missing?.bucketId ?? ""}` };
    },
  );

export type Session = z.infer<typeof SessionSchema>;
