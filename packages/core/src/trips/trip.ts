import { z } from "zod";

const DayIntSchema = z.number().int();

export const DayAttributionSchema = z.object({
  day: DayIntSchema,
  consumesLeave: z.boolean().optional(),
  isTravelDay: z.boolean().optional(),
  halfDay: z.boolean().optional(),
  location: z.enum(["residence", "home", "transit"]).optional(),
});

export type DayAttribution = z.infer<typeof DayAttributionSchema>;

export const TripSchema = z
  .object({
    id: z.string().min(1),
    departure: DayIntSchema,
    return: DayIntSchema,
    bucketId: z.string().min(1),
    isActual: z.boolean(),
    dayOverrides: z.array(DayAttributionSchema),
    notes: z.string().optional(),
  })
  .refine((t) => t.return >= t.departure, { message: "return must be >= departure" })
  .refine(
    (t) => t.dayOverrides.every((o) => o.day >= t.departure && o.day <= t.return),
    { message: "dayOverrides must fall within [departure, return]" },
  )
  .refine(
    (t) => new Set(t.dayOverrides.map((o) => o.day)).size === t.dayOverrides.length,
    { message: "dayOverrides must not contain duplicate days" },
  );

export type Trip = z.infer<typeof TripSchema>;
