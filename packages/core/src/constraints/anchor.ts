import { z } from "zod";

const DayIntSchema = z.number().int();

export const AnchorDateSchema = z.object({
  day: DayIntSchema,
  preferIn: z.enum(["home", "residence"]),
  weight: z.number().nonnegative(),
});

export type AnchorDate = z.infer<typeof AnchorDateSchema>;
