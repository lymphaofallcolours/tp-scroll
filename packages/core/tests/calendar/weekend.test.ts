import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { toDayInt } from "../../src/calendar/day-int.js";
import { isWeekend, weekendDaysFor } from "../../src/calendar/weekend.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));

describe("weekend resolution", () => {
  describe("default (Sat-Sun) — applies to most countries including DE, ES, FR", () => {
    it("treats Saturday as a weekend day", () => {
      expect(isWeekend(d("2026-05-09"), "DE")).toBe(true); // Saturday
    });

    it("treats Sunday as a weekend day", () => {
      expect(isWeekend(d("2026-05-10"), "ES")).toBe(true); // Sunday
    });

    it("treats Monday as a non-weekend day", () => {
      expect(isWeekend(d("2026-05-11"), "FR")).toBe(false);
    });
  });

  describe("Israel (IL) — Friday + Saturday", () => {
    it("treats Friday as a weekend day", () => {
      expect(isWeekend(d("2026-05-08"), "IL")).toBe(true); // Friday
    });

    it("treats Saturday as a weekend day", () => {
      expect(isWeekend(d("2026-05-09"), "IL")).toBe(true);
    });

    it("treats Sunday as a workday in Israel", () => {
      expect(isWeekend(d("2026-05-10"), "IL")).toBe(false);
    });
  });

  describe("weekendDaysFor", () => {
    it("returns Sat+Sun for DE", () => {
      expect(weekendDaysFor("DE")).toEqual(new Set([6, 7]));
    });

    it("returns Fri+Sat for IL", () => {
      expect(weekendDaysFor("IL")).toEqual(new Set([5, 6]));
    });
  });
});
