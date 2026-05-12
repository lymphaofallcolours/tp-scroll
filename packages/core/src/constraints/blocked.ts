import { z } from "zod";

import { overlaps } from "../calendar/range.js";
import { type Trip } from "../trips/trip.js";

const DayIntSchema = z.number().int();

export const BlockedPeriodSchema = z
  .object({
    start: DayIntSchema,
    end: DayIntSchema,
    reason: z.string().min(1),
  })
  .refine((b) => b.end >= b.start, { message: "end must be >= start" });

export type BlockedPeriod = z.infer<typeof BlockedPeriodSchema>;

export const tripOverlapsBlocked = (trip: Trip, blocked: BlockedPeriod): boolean =>
  overlaps({ start: trip.departure, end: trip.return }, { start: blocked.start, end: blocked.end });
