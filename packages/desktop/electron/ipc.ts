import { ipcMain } from "electron";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  SessionSchema,
  SystemClock,
  optimize,
  type Session,
  type DayInt,
  type TripPlan,
} from "@tp-scroll/core";
import {
  DateHolidaysProvider,
  FallbackHolidayProvider,
  NagerHolidayProvider,
  type HolidayProvider,
} from "@tp-scroll/adapter-holidays";
import {
  JsonFileSessionStore,
  type SessionStore,
} from "@tp-scroll/adapter-storage";
import {
  CachingFlightProvider,
  MockFlightProvider,
  amadeusFromEnv,
  annotatePlan,
  type FlightProvider,
} from "@tp-scroll/adapter-flights";

const home = homedir();
const dataDir = join(home, ".tp-scroll");
const sessionsDir = join(dataDir, "sessions");
const activeFile = join(dataDir, "active.json");

const offline = process.env["TP_SCROLL_NETWORK"] === "off";

const store: SessionStore = new JsonFileSessionStore({ baseDir: sessionsDir });
const holidayProvider: HolidayProvider = offline
  ? new DateHolidaysProvider()
  : new FallbackHolidayProvider(new NagerHolidayProvider(), new DateHolidaysProvider());

const realFlight: FlightProvider | null = offline ? null : amadeusFromEnv();
const flightProvider: FlightProvider = new CachingFlightProvider(
  realFlight ?? new MockFlightProvider(),
);

const loadActive = async (): Promise<string | null> => {
  try {
    const raw = await readFile(activeFile, "utf-8");
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
};

const setActive = async (id: string): Promise<void> => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(activeFile, JSON.stringify({ id }), "utf-8");
};

export const registerIpc = (): void => {
  ipcMain.handle("sessions:list", () => store.list());
  ipcMain.handle("sessions:load", (_, id: string) => store.load(id));
  ipcMain.handle("sessions:save", async (_, raw: unknown) => {
    const session = SessionSchema.parse(raw);
    await store.save(session);
  });
  ipcMain.handle("sessions:delete", (_, id: string) => store.delete(id));

  ipcMain.handle("active:get", () => loadActive());
  ipcMain.handle("active:set", (_, id: string) => setActive(id));

  ipcMain.handle("holidays:forCountry", (_, cc: string, year: number) =>
    holidayProvider.forCountry(cc, year),
  );

  ipcMain.handle(
    "optimizer:run",
    async (_, req: { sessionId: string; holidayYear?: number; topK?: number; seedCount?: number }) => {
      const session = await store.load(req.sessionId);
      const year = req.holidayYear ?? new Date().getUTCFullYear();
      const holidays = await holidayProvider.forCountry(session.residenceCountry, year);
      return optimize(session as Session, {
        clock: SystemClock,
        holidays: new Set(holidays.map((h) => h.day)),
        ...(req.topK !== undefined ? { topK: req.topK } : {}),
        ...(req.seedCount !== undefined ? { seedCount: req.seedCount } : {}),
      });
    },
  );

  ipcMain.handle("clock:today", (): DayInt => SystemClock.today());

  ipcMain.handle("flights:providerName", () => flightProvider.name);
  ipcMain.handle(
    "flights:annotate",
    async (_, req: { plan: TripPlan; origin: string; destination: string }) => {
      return annotatePlan({
        plan: req.plan,
        provider: flightProvider,
        origin: req.origin,
        destination: req.destination,
      });
    },
  );
};
