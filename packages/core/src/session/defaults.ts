import { type Session } from "./session.js";

export type SessionSeed = {
  id: string;
  name: string;
  residenceCountry: string;
  homeCountry: string;
};

// 2026-01-01 → 2026-12-31 as DayInt (epoch 2000-01-01).
const DEFAULT_CYCLE_START = 9497;
const DEFAULT_CYCLE_END = 9861;

export const defaultSession = (seed: SessionSeed): Session => {
  const now = new Date().toISOString();
  return {
    id: seed.id,
    name: seed.name,
    residenceCountry: seed.residenceCountry.toUpperCase(),
    homeCountry: seed.homeCountry.toUpperCase(),
    cycle: {
      id: `${seed.id}-cycle`,
      name: seed.name,
      kind: "calendar",
      start: DEFAULT_CYCLE_START,
      end: DEFAULT_CYCLE_END,
      totalDays: 25,
      carryover: { mode: "lose" },
      bufferAtEnd: 0,
      halfDaysAllowed: false,
      countWeekends: false,
    },
    buckets: [
      {
        id: "annual",
        name: "annual",
        cycleId: `${seed.id}-cycle`,
        totalDays: 25,
        kind: "annual",
      },
    ],
    trips: [],
    blocked: [],
    anchors: [],
    extraHolidays: [],
    overriddenHolidays: [],
    departureMode: "last-home-day",
    minTripDays: 2,
    maxTripDays: 21,
    minGapDays: 0,
    maxGapDays: 365,
    regions: [],
    travelDayConsumesLeaveByDefault: false,
    cycleHistory: [],
    createdAt: now,
    updatedAt: now,
  };
};
