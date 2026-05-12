import { z } from "zod";

import { type DayInt } from "../calendar/day-int.js";

const DayIntSchema = z.number().int();

export const AnchorDateSchema = z.object({
  day: DayIntSchema,
  preferIn: z.enum(["home", "residence"]),
  weight: z.number().nonnegative(),
});

export type AnchorDate = z.infer<typeof AnchorDateSchema>;

export type IsAtHome = (day: DayInt) => boolean;

export const anchorSatisfied = (anchor: AnchorDate, isAtHome: IsAtHome): boolean => {
  const atHome = isAtHome(anchor.day);
  return anchor.preferIn === "home" ? atHome : !atHome;
};

export const anchorCoverageScore = (
  anchors: ReadonlyArray<AnchorDate>,
  isAtHome: IsAtHome,
): number => anchors.reduce((s, a) => s + (anchorSatisfied(a, isAtHome) ? a.weight : 0), 0);
