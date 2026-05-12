import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";

import { FixedClock } from "../../src/calendar/clock.js";
import { toDayInt } from "../../src/calendar/day-int.js";
import { optimize } from "../../src/optimizer/index.js";
import { planSimilarity } from "../../src/optimizer/diversity.js";
import { makeSession } from "../fixtures/sessions.js";

const d = (iso: string): number => toDayInt(Temporal.PlainDate.from(iso));
const clock = FixedClock(d("2025-12-15"));

import type { Session } from "../../src/session/session.js";

const yearSession = (overrides: Partial<Session> = {}): Session =>
  makeSession({
    cycle: {
      id: "c",
      name: "2026",
      kind: "calendar",
      start: d("2026-01-01"),
      end: d("2026-12-31"),
      totalDays: 25,
      carryover: { mode: "lose" },
      bufferAtEnd: 0,
      halfDaysAllowed: false,
      countWeekends: false,
    },
    minTripDays: 3,
    maxTripDays: 14,
    ...overrides,
  });

describe("optimize with multi-seed search", () => {
  it("seedCount=1 matches single-search behavior", () => {
    const session = yearSession();
    const a = optimize(session, { clock, holidays: new Set(), topK: 5 });
    const b = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 1 });
    expect(a.map((p) => p.awayDaysTotal)).toEqual(b.map((p) => p.awayDaysTotal));
  });

  it("seedCount=5 returns 5 plans on a one-year cycle", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 5 });
    expect(plans.length).toBe(5);
  });

  it("seedCount=5 produces a meaningfully diverse top-K (at least one pair ≤ 0.5 similar)", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 5 });
    let foundDiverse = false;
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        if (planSimilarity(plans[i]!, plans[j]!) <= 0.5) {
          foundDiverse = true;
        }
      }
    }
    expect(foundDiverse).toBe(true);
  });

  it("seedCount=5 first trips span at least 2 quintiles of the year", () => {
    const session = yearSession();
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 5 });
    const firstTripStarts = plans
      .filter((p) => p.trips.length > 0)
      .map((p) => p.trips.slice().sort((a, b) => a.departure - b.departure)[0]!.departure);
    const cycleLen = d("2026-12-31") - d("2026-01-01") + 1;
    const quintile = (day: number): number =>
      Math.floor(((day - d("2026-01-01")) * 5) / cycleLen);
    const quintilesHit = new Set(firstTripStarts.map(quintile));
    expect(quintilesHit.size).toBeGreaterThanOrEqual(2);
  });

  it("each returned plan still respects the leave budget", () => {
    const base = yearSession();
    const session = yearSession({
      cycle: { ...base.cycle, totalDays: 10 },
      buckets: [{ ...base.buckets[0]!, totalDays: 10 }],
    });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 5 });
    for (const plan of plans) expect(plan.leaveCostTotal).toBeLessThanOrEqual(10);
  });

  it("multi-seed never overlaps the active session's blocked periods", () => {
    const session = yearSession({
      blocked: [{ start: d("2026-09-01"), end: d("2026-09-30"), reason: "teaching" }],
    });
    const plans = optimize(session, { clock, holidays: new Set(), topK: 5, seedCount: 5 });
    for (const plan of plans) {
      for (const trip of plan.trips) {
        const overlapsBlock = trip.departure <= d("2026-09-30") && trip.return >= d("2026-09-01");
        expect(overlapsBlock).toBe(false);
      }
    }
  });
});
