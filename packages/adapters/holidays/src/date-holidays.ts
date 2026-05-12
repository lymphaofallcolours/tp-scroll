import { dayIntFromIso } from "@tp-scroll/core";
import HolidaysLib from "date-holidays";

import type { Holiday, HolidayProvider } from "./provider.js";

export class DateHolidaysProvider implements HolidayProvider {
  readonly name = "date-holidays";

  async forCountry(countryCode: string, year: number): Promise<ReadonlyArray<Holiday>> {
    const hd = new HolidaysLib(countryCode.toUpperCase());
    const raw = hd.getHolidays(year) ?? [];
    return raw
      .filter((h) => h.type === "public")
      .map((h) => ({
        day: dayIntFromIso(h.date.slice(0, 10)),
        name: h.name,
        type: "public" as const,
      }));
  }
}
