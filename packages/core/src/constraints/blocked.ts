import { z } from "zod";

const DayIntSchema = z.number().int();

export const BlockedPeriodSchema = z
  .object({
    start: DayIntSchema,
    end: DayIntSchema,
    reason: z.string().min(1),
  })
  .refine((b) => b.end >= b.start, { message: "end must be >= start" });

export type BlockedPeriod = z.infer<typeof BlockedPeriodSchema>;
