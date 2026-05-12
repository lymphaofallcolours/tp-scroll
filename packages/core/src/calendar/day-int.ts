import { Temporal } from "@js-temporal/polyfill";

export type DayInt = number;

export const EPOCH: Temporal.PlainDate = Temporal.PlainDate.from("2000-01-01");

export const toDayInt = (date: Temporal.PlainDate): DayInt =>
  EPOCH.until(date, { largestUnit: "days" }).days;

export const fromDayInt = (n: DayInt): Temporal.PlainDate => EPOCH.add({ days: n });

export const dayIntFromIso = (iso: string): DayInt =>
  toDayInt(Temporal.PlainDate.from(iso));

export const isoFromDayInt = (n: DayInt): string => fromDayInt(n).toString();
