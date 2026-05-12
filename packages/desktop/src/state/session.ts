import { create } from "zustand";
import { fromDayInt, type Session, type Trip } from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";

import { bridge } from "../api/bridge.js";
import { buildDemoSession } from "../demo/demoSession.js";

type Status = "idle" | "loading" | "ready" | "error";

type SessionState = {
  readonly status: Status;
  readonly session: Session | null;
  readonly holidays: ReadonlyArray<Holiday>;
  readonly isDemo: boolean;
  readonly errorMessage: string | null;
  readonly init: () => Promise<void>;
  readonly addTrip: (trip: Trip) => Promise<void>;
  readonly updateTrip: (trip: Trip) => Promise<void>;
  readonly deleteTrip: (tripId: string) => Promise<void>;
};

const persist = async (session: Session, isDemo: boolean): Promise<void> => {
  if (isDemo) return;
  await bridge.sessions.save(session);
};

const touch = (session: Session): Session => ({
  ...session,
  updatedAt: new Date().toISOString(),
});

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "idle",
  session: null,
  holidays: [],
  isDemo: false,
  errorMessage: null,

  init: async () => {
    set({ status: "loading" });
    try {
      const activeId = await bridge.active.get();
      let session: Session | null = null;
      if (activeId !== null) {
        try {
          session = await bridge.sessions.load(activeId);
        } catch {
          session = null;
        }
      }
      const isDemo = session === null;
      const actual = session ?? buildDemoSession();
      let holidays: ReadonlyArray<Holiday> = [];
      try {
        const year = fromDayInt(actual.cycle.start).year;
        holidays = await bridge.holidays.forCountry(actual.residenceCountry, year);
      } catch {
        holidays = [];
      }
      set({ status: "ready", session: actual, holidays, isDemo, errorMessage: null });
    } catch (err) {
      set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
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
}));
