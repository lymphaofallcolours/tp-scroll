import { z } from "zod";

const DayIntSchema = z.number().int();
const NonNegInt = z.number().int().nonnegative();

const CarryoverSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("lose") }),
  z.object({ mode: z.literal("cumulative"), maxDays: NonNegInt }),
]);

export const LeaveCycleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["calendar", "fiscal", "anniversary"]),
    start: DayIntSchema,
    end: DayIntSchema,
    resetDayOfYear: z.number().int().min(1).max(366).optional(),
    totalDays: NonNegInt,
    carryover: CarryoverSchema,
    bufferAtEnd: NonNegInt,
    bookingHorizonDays: NonNegInt.optional(),
    halfDaysAllowed: z.boolean(),
    countWeekends: z.boolean(),
  })
  .refine((c) => c.end >= c.start, { message: "end must be >= start" })
  .refine((c) => c.bufferAtEnd <= c.totalDays, {
    message: "bufferAtEnd must not exceed totalDays",
  });

export type LeaveCycle = z.infer<typeof LeaveCycleSchema>;
