import { z } from "zod";

import { AnchorDateSchema } from "../constraints/anchor.js";
import { BlockedPeriodSchema } from "../constraints/blocked.js";
import { SchengenWatchSchema } from "../constraints/schengen.js";
import { LeaveBucketSchema } from "../leave/bucket.js";
import { LeaveCycleSchema } from "../leave/cycle.js";
import { TripSchema } from "../trips/trip.js";

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
    extraHolidays: z.array(ExtraHolidaySchema),
    overriddenHolidays: z.array(OverriddenHolidaySchema),
    departureMode: DepartureModeSchema,
    minTripDays: z.number().int().positive(),
    maxTripDays: z.number().int().positive(),
    travelDayConsumesLeaveByDefault: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((s) => s.minTripDays <= s.maxTripDays, {
    message: "minTripDays must be <= maxTripDays",
  });

export type Session = z.infer<typeof SessionSchema>;
