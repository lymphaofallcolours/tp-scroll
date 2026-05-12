import type { DayInt } from "@tp-scroll/core";

export type Holiday = {
  readonly day: DayInt;
  readonly name: string;
  readonly type: "public" | "regional";
  readonly region?: string;
};

export type HolidayProvider = {
  readonly name: string;
  forCountry(countryCode: string, year: number): Promise<ReadonlyArray<Holiday>>;
};
