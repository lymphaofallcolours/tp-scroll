import { dayIntFromIso } from "@tp-scroll/core";
import { z } from "zod";

import type { Holiday, HolidayProvider } from "./provider.js";

const NagerHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  localName: z.string(),
  name: z.string(),
  countryCode: z.string(),
  global: z.boolean().optional(),
  counties: z.array(z.string()).nullable().optional(),
  types: z.array(z.string()).optional(),
});

const NagerResponseSchema = z.array(NagerHolidaySchema);

export type NagerOptions = {
  readonly fetch?: typeof fetch;
  readonly baseUrl?: string;
};

const DEFAULT_BASE = "https://date.nager.at/api/v3/PublicHolidays";

export class NagerHolidayProvider implements HolidayProvider {
  readonly name = "nager";
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: NagerOptions = {}) {
    this.fetchFn = opts.fetch ?? globalThis.fetch;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  async forCountry(countryCode: string, year: number): Promise<ReadonlyArray<Holiday>> {
    const cc = countryCode.toUpperCase();
    const url = `${this.baseUrl}/${year}/${cc}`;
    const res = await this.fetchFn(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Nager request failed: ${res.status} ${res.statusText} (${url})`);
    }
    const json: unknown = await res.json();
    const parsed = NagerResponseSchema.parse(json);
    return parsed.map((h) => {
      const isRegional = Array.isArray(h.counties) && h.counties.length > 0;
      const day = dayIntFromIso(h.date);
      if (isRegional) {
        return {
          day,
          name: h.name,
          type: "regional" as const,
          region: h.counties![0]!,
        };
      }
      return { day, name: h.name, type: "public" as const };
    });
  }
}
