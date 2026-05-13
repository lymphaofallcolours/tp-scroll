import { create } from "zustand";
import {
  defaultSession,
  fromDayInt,
  rollCycle,
  type AnchorDate,
  type BlockedPeriod,
  type BucketKind,
  type DepartureMode,
  type FlightConstraints,
  type LeaveBucket,
  type LeaveCycle,
  type RegionOverride,
  type Session,
  type Trip,
} from "@tp-scroll/core";

/**
 * Patch shape for the Cycle Rules card. Keeps the per-field nature of the form
 * (any subset can be sent) while making the legal keys explicit at the call
 * site so we don't accidentally let the UI mutate `start`/`end`/`totalDays`
 * via this path — those are owned by Roll Cycle.
 */
type CycleRulesPatch = {
  readonly countWeekends?: boolean;
  readonly countHolidays?: boolean;
  readonly halfDaysAllowed?: boolean;
  readonly bufferAtEnd?: number;
  readonly carryover?: LeaveCycle["carryover"];
};
import type { Holiday } from "@tp-scroll/adapter-holidays";
import type { SessionSummary } from "@tp-scroll/adapter-storage";

import { bridge } from "../api/bridge.js";
import { buildDemoSession } from "../demo/demoSession.js";

type Status = "idle" | "loading" | "ready" | "error";

type SessionState = {
  readonly status: Status;
  readonly session: Session | null;
  readonly holidays: ReadonlyArray<Holiday>;
  readonly homeHolidays: ReadonlyArray<Holiday>;
  readonly isDemo: boolean;
  readonly errorMessage: string | null;
  readonly summaries: ReadonlyArray<SessionSummary>;
  readonly init: () => Promise<void>;
  readonly refreshSummaries: () => Promise<void>;
  readonly addTrip: (trip: Trip) => Promise<void>;
  readonly updateTrip: (trip: Trip) => Promise<void>;
  readonly deleteTrip: (tripId: string) => Promise<void>;
  readonly createSession: (input: {
    name: string;
    residenceCountry: string;
    homeCountry: string;
  }) => Promise<void>;
  readonly switchSession: (id: string) => Promise<void>;
  readonly deleteSession: (id: string) => Promise<void>;
  readonly rollActiveCycle: (input: {
    name: string;
    start: number;
    end: number;
    totalDays: number;
  }) => Promise<void>;
  readonly setFlightConstraints: (constraints: FlightConstraints | null) => Promise<void>;
  readonly addBucket: (input: {
    id: string;
    name: string;
    totalDays: number;
    kind: BucketKind;
  }) => Promise<void>;
  readonly setTripBounds: (input: {
    minTripDays: number;
    maxTripDays: number;
    minGapDays: number;
    maxGapDays: number;
  }) => Promise<void>;
  readonly addBlocked: (input: BlockedPeriod) => Promise<void>;
  readonly deleteBlocked: (start: number, end: number) => Promise<void>;
  readonly addRegion: (input: RegionOverride) => Promise<void>;
  readonly deleteRegion: (id: string) => Promise<void>;
  readonly setCycleRules: (patch: CycleRulesPatch) => Promise<void>;
  readonly setDepartureMode: (mode: DepartureMode) => Promise<void>;
  readonly addAnchor: (input: AnchorDate) => Promise<void>;
  readonly deleteAnchor: (day: number) => Promise<void>;
  readonly updateAnchor: (day: number, patch: Partial<Omit<AnchorDate, "day">>) => Promise<void>;
};

const persist = async (session: Session, isDemo: boolean): Promise<void> => {
  if (isDemo) return;
  await bridge.sessions.save(session);
};

const touch = (session: Session): Session => ({
  ...session,
  updatedAt: new Date().toISOString(),
});

const loadHolidaysFor = async (session: Session): Promise<ReadonlyArray<Holiday>> => {
  try {
    const year = fromDayInt(session.cycle.start).year;
    return await bridge.holidays.forCountry(session.residenceCountry, year);
  } catch {
    return [];
  }
};

const loadHomeHolidaysFor = async (session: Session): Promise<ReadonlyArray<Holiday>> => {
  if (session.homeCountry === session.residenceCountry) return [];
  try {
    const year = fromDayInt(session.cycle.start).year;
    return await bridge.holidays.forCountry(session.homeCountry, year);
  } catch {
    return [];
  }
};

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "idle",
  session: null,
  holidays: [],
  homeHolidays: [],
  isDemo: false,
  errorMessage: null,
  summaries: [],

  init: async () => {
    set({ status: "loading" });
    try {
      const summaries = await bridge.sessions.list();
      const activeId = await bridge.active.get();
      let session: Session | null = null;
      if (activeId !== null) {
        try {
          session = await bridge.sessions.load(activeId);
        } catch {
          session = null;
        }
      }
      // Fall back to the first available session if there's no active one.
      if (session === null && summaries.length > 0) {
        try {
          session = await bridge.sessions.load(summaries[0]!.id);
          await bridge.active.set(summaries[0]!.id);
        } catch {
          session = null;
        }
      }
      const isDemo = session === null;
      const actual = session ?? buildDemoSession();
      const [holidays, homeHolidays] = await Promise.all([
        loadHolidaysFor(actual),
        loadHomeHolidaysFor(actual),
      ]);
      set({
        status: "ready",
        session: actual,
        holidays,
        homeHolidays,
        isDemo,
        errorMessage: null,
        summaries,
      });
    } catch (err) {
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  refreshSummaries: async () => {
    try {
      const summaries = await bridge.sessions.list();
      set({ summaries });
    } catch {
      // ignore
    }
  },

  addTrip: async (trip) => {
    const s = get().session;
    if (!s) return;
    const next = touch({ ...s, trips: [...s.trips, trip] });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  updateTrip: async (trip) => {
    const s = get().session;
    if (!s) return;
    const next = touch({
      ...s,
      trips: s.trips.map((t) => (t.id === trip.id ? trip : t)),
    });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  deleteTrip: async (tripId) => {
    const s = get().session;
    if (!s) return;
    const next = touch({ ...s, trips: s.trips.filter((t) => t.id !== tripId) });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  createSession: async ({ name, residenceCountry, homeCountry }) => {
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
    const fresh = defaultSession({ id, name, residenceCountry, homeCountry });
    await bridge.sessions.save(fresh);
    await bridge.active.set(id);
    const [holidays, homeHolidays] = await Promise.all([
      loadHolidaysFor(fresh),
      loadHomeHolidaysFor(fresh),
    ]);
    const summaries = await bridge.sessions.list();
    set({ session: fresh, holidays, homeHolidays, isDemo: false, summaries });
  },

  switchSession: async (id) => {
    const session = await bridge.sessions.load(id);
    await bridge.active.set(id);
    const [holidays, homeHolidays] = await Promise.all([
      loadHolidaysFor(session),
      loadHomeHolidaysFor(session),
    ]);
    set({ session, holidays, homeHolidays, isDemo: false });
  },

  deleteSession: async (id) => {
    await bridge.sessions.delete(id);
    const summaries = await bridge.sessions.list();
    set({ summaries });
    // If we deleted the active one, fall back to first available or demo.
    if (get().session?.id === id) {
      if (summaries.length > 0) {
        await get().switchSession(summaries[0]!.id);
      } else {
        const demo = buildDemoSession();
        const [holidays, homeHolidays] = await Promise.all([
          loadHolidaysFor(demo),
          loadHomeHolidaysFor(demo),
        ]);
        set({ session: demo, holidays, homeHolidays, isDemo: true });
      }
    }
  },

  rollActiveCycle: async ({ name, start, end, totalDays }) => {
    const s = get().session;
    if (!s) return;
    if (end < start) {
      throw new Error("new end must be on or after new start");
    }
    // Hard cap: a cycle is a year-ish of leave. Allowing multi-year cycles
    // makes the optimizer's O(days × maxTripDays) candidate set blow up
    // (one user mis-typed 2025 instead of 2026, creating a 3-year cycle).
    const cycleLen = end - start + 1;
    if (cycleLen > 400) {
      throw new Error(
        `new cycle spans ${cycleLen} days — limit is 400. Check the start/end years.`,
      );
    }
    const newCycle: LeaveCycle = {
      ...s.cycle,
      id: `${s.id}-cycle-${start}`,
      name,
      start,
      end,
      totalDays,
    };
    const newBuckets: LeaveBucket[] = [
      {
        id: "annual",
        name: "annual",
        cycleId: newCycle.id,
        totalDays,
        kind: "annual",
      },
    ];
    const rolled = rollCycle(s, newCycle, newBuckets);
    set({ session: rolled });
    await persist(rolled, get().isDemo);
    const [holidays, homeHolidays] = await Promise.all([
      loadHolidaysFor(rolled),
      loadHomeHolidaysFor(rolled),
    ]);
    set({ holidays, homeHolidays });
  },

  setFlightConstraints: async (constraints) => {
    const s = get().session;
    if (!s) return;
    const next = touch(
      constraints === null
        ? { ...s, flightConstraints: undefined }
        : { ...s, flightConstraints: constraints },
    );
    set({ session: next });
    await persist(next, get().isDemo);
  },

  addBucket: async (input) => {
    const s = get().session;
    if (!s) return;
    if (s.buckets.some((b) => b.id === input.id)) {
      throw new Error(`bucket already exists: ${input.id}`);
    }
    const next = touch({
      ...s,
      buckets: [
        ...s.buckets,
        {
          id: input.id,
          name: input.name,
          cycleId: s.cycle.id,
          totalDays: input.totalDays,
          kind: input.kind,
        },
      ],
    });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  addBlocked: async (input) => {
    const s = get().session;
    if (!s) return;
    if (input.end < input.start) {
      throw new Error("end must be >= start");
    }
    if (s.blocked.some((b) => b.start === input.start && b.end === input.end)) {
      throw new Error("a period with the same start/end already exists");
    }
    const next = touch({ ...s, blocked: [...s.blocked, input] });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  deleteBlocked: async (start, end) => {
    const s = get().session;
    if (!s) return;
    const next = touch({
      ...s,
      blocked: s.blocked.filter((b) => !(b.start === start && b.end === end)),
    });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  addRegion: async (input) => {
    const s = get().session;
    if (!s) return;
    if (input.end < input.start) throw new Error("end must be >= start");
    if (s.regions.some((r) => r.id === input.id)) {
      throw new Error(`a region with id "${input.id}" already exists`);
    }
    const next = touch({ ...s, regions: [...s.regions, input] });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  deleteRegion: async (id) => {
    const s = get().session;
    if (!s) return;
    const next = touch({ ...s, regions: s.regions.filter((r) => r.id !== id) });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  setCycleRules: async (patch) => {
    const s = get().session;
    if (!s) return;
    const cycle: LeaveCycle = {
      ...s.cycle,
      ...(patch.countWeekends !== undefined ? { countWeekends: patch.countWeekends } : {}),
      ...(patch.countHolidays !== undefined ? { countHolidays: patch.countHolidays } : {}),
      ...(patch.halfDaysAllowed !== undefined ? { halfDaysAllowed: patch.halfDaysAllowed } : {}),
      ...(patch.bufferAtEnd !== undefined ? { bufferAtEnd: patch.bufferAtEnd } : {}),
      ...(patch.carryover !== undefined ? { carryover: patch.carryover } : {}),
    };
    if (cycle.bufferAtEnd > cycle.totalDays) {
      throw new Error("bufferAtEnd cannot exceed cycle.totalDays");
    }
    const next = touch({ ...s, cycle });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  setDepartureMode: async (mode) => {
    const s = get().session;
    if (!s) return;
    const next = touch({ ...s, departureMode: mode });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  addAnchor: async (input) => {
    const s = get().session;
    if (!s) return;
    if (s.anchors.some((a) => a.day === input.day && a.preferIn === input.preferIn)) return;
    const next = touch({ ...s, anchors: [...s.anchors, input] });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  deleteAnchor: async (day) => {
    const s = get().session;
    if (!s) return;
    const next = touch({ ...s, anchors: s.anchors.filter((a) => a.day !== day) });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  updateAnchor: async (day, patch) => {
    const s = get().session;
    if (!s) return;
    const idx = s.anchors.findIndex((a) => a.day === day);
    if (idx === -1) return;
    const current = s.anchors[idx]!;
    const merged: AnchorDate = {
      day: current.day,
      preferIn: patch.preferIn ?? current.preferIn,
      weight: patch.weight ?? current.weight,
    };
    if (merged.weight < 0) throw new Error("anchor weight must be >= 0");
    const nextAnchors = [...s.anchors];
    nextAnchors[idx] = merged;
    const next = touch({ ...s, anchors: nextAnchors });
    set({ session: next });
    await persist(next, get().isDemo);
  },

  setTripBounds: async ({ minTripDays, maxTripDays, minGapDays, maxGapDays }) => {
    const s = get().session;
    if (!s) return;
    const ok =
      Number.isFinite(minTripDays) &&
      Number.isFinite(maxTripDays) &&
      Number.isFinite(minGapDays) &&
      Number.isFinite(maxGapDays) &&
      minTripDays >= 1 &&
      maxTripDays >= minTripDays &&
      minGapDays >= 0 &&
      maxGapDays >= minGapDays;
    if (!ok) {
      throw new Error(
        `invalid bounds: trip ${minTripDays}-${maxTripDays}, gap ${minGapDays}-${maxGapDays}`,
      );
    }
    const next = touch({ ...s, minTripDays, maxTripDays, minGapDays, maxGapDays });
    set({ session: next });
    await persist(next, get().isDemo);
  },
}));
