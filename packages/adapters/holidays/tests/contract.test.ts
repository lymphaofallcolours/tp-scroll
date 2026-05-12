import { describe, it, expect } from "vitest";

import { DateHolidaysProvider } from "../src/date-holidays.js";
import { NagerHolidayProvider } from "../src/nager.js";
import type { HolidayProvider } from "../src/provider.js";
import { canned2026DE_nagerResponse } from "./fixtures/nager-fixture.js";

const runContract = (label: string, make: () => HolidayProvider) => {
  describe(`HolidayProvider contract — ${label}`, () => {
    it("returns a non-empty array for DE 2026", async () => {
      const provider = make();
      const result = await provider.forCountry("DE", 2026);
      expect(result.length).toBeGreaterThan(0);
    });

    it("every Holiday has integer day, non-empty name, public/regional type", async () => {
      const provider = make();
      const result = await provider.forCountry("DE", 2026);
      for (const h of result) {
        expect(Number.isInteger(h.day)).toBe(true);
        expect(h.name.length).toBeGreaterThan(0);
        expect(["public", "regional"]).toContain(h.type);
      }
    });

    it("includes Labour Day (2026-05-01) in DE", async () => {
      const provider = make();
      const result = await provider.forCountry("DE", 2026);
      // 2026-05-01 = DayInt 9617 (epoch 2000-01-01)
      const mayFirst = result.find((h) => h.day === 9617);
      expect(mayFirst).toBeDefined();
    });

    it("accepts lowercase country codes (case-insensitive)", async () => {
      const provider = make();
      const result = await provider.forCountry("de", 2026);
      expect(result.length).toBeGreaterThan(0);
    });
  });
};

runContract("DateHolidaysProvider", () => new DateHolidaysProvider());

runContract("NagerHolidayProvider (with mocked fetch)", () => {
  const mockFetch = async (): Promise<Response> =>
    new Response(JSON.stringify(canned2026DE_nagerResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  return new NagerHolidayProvider({ fetch: mockFetch });
});
