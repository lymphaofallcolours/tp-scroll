import { z } from "zod";

export const BucketKindSchema = z.enum(["annual", "sick", "parental", "conference", "other"]);
export type BucketKind = z.infer<typeof BucketKindSchema>;

export const LeaveBucketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cycleId: z.string().min(1),
  totalDays: z.number().int().nonnegative(),
  /**
   * Discriminator that lets the UI colour-code buckets and lets the optimizer
   * default its planning bucket to annual leave even when other kinds appear
   * earlier in the list. Defaults to "annual" so v0.2-era sessions migrate
   * transparently.
   */
  kind: BucketKindSchema.default("annual"),
});

export type LeaveBucket = z.infer<typeof LeaveBucketSchema>;

/**
 * CSS custom-property name for the bucket's visual treatment. Single source of
 * truth shared by the calendar grid, the buckets card, and the status view.
 * Values reference `--accent-bucket-{kind}` tokens defined in the desktop's
 * tokens.css.
 */
export const bucketKindColor = (kind: BucketKind): string => `--accent-bucket-${kind}`;
