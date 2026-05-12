import { Temporal } from "@js-temporal/polyfill";

import { type DayInt, toDayInt } from "./day-int.js";

export type Clock = {
  today(): DayInt;
};

export const FixedClock = (day: DayInt): Clock => ({ today: () => day });

export const SystemClock: Clock = {
  today: () => toDayInt(Temporal.Now.plainDateISO()),
};
