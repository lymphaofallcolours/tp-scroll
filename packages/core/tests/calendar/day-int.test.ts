import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { EPOCH, toDayInt, fromDayInt } from "../../src/calendar/day-int.js";

describe("DayInt", () => {
  it("treats the epoch (2000-01-01) as day 0", () => {
    expect(toDayInt(EPOCH)).toBe(0);
  });

  it("round-trips fromDayInt → toDayInt for any DayInt", () => {
    for (const n of [-365, -1, 0, 1, 100, 9999]) {
      expect(toDayInt(fromDayInt(n))).toBe(n);
    }
  });

  it("computes positive offsets for dates after the epoch", () => {
    const day = Temporal.PlainDate.from("2026-05-12");
    const expected = EPOCH.until(day, { largestUnit: "days" }).days;
    expect(toDayInt(day)).toBe(expected);
    expect(expected).toBeGreaterThan(9000);
  });

  it("computes negative offsets for dates before the epoch", () => {
    const day = Temporal.PlainDate.from("1999-12-31");
    expect(toDayInt(day)).toBe(-1);
  });

  it("treats each successive day as +1", () => {
    const a = toDayInt(Temporal.PlainDate.from("2026-05-12"));
    const b = toDayInt(Temporal.PlainDate.from("2026-05-13"));
    expect(b - a).toBe(1);
  });

  it("matches DST-free arithmetic across a daylight-savings boundary", () => {
    // 2026 European spring-forward is on 2026-03-29. DayInt is a calendar
    // primitive so it must not change distance because clocks moved.
    const before = toDayInt(Temporal.PlainDate.from("2026-03-28"));
    const after = toDayInt(Temporal.PlainDate.from("2026-03-30"));
    expect(after - before).toBe(2);
  });
});
