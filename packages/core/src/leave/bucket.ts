import { z } from "zod";

export const LeaveBucketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cycleId: z.string().min(1),
  totalDays: z.number().int().nonnegative(),
});

export type LeaveBucket = z.infer<typeof LeaveBucketSchema>;
