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
  AmadeusFlightProvider,
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
const flightsCredsFile = join(dataDir, "flights.json");

const offline = process.env["TP_SCROLL_NETWORK"] === "off";

const store: SessionStore = new JsonFileSessionStore({ baseDir: sessionsDir });
const holidayProvider: HolidayProvider = offline
  ? new DateHolidaysProvider()
  : new FallbackHolidayProvider(new NagerHolidayProvider(), new DateHolidaysProvider());

type CredsSource = "env" | "file" | "none";
type StoredCreds = { readonly clientId: string; readonly clientSecret: string };

const loadCredsFromFile = async (): Promise<StoredCreds | null> => {
  try {
    const raw = await readFile(flightsCredsFile, "utf-8");
    const parsed = JSON.parse(raw) as { clientId?: unknown; clientSecret?: unknown };
    if (typeof parsed.clientId !== "string" || typeof parsed.clientSecret !== "string") return null;
    if (parsed.clientId.length === 0 || parsed.clientSecret.length === 0) return null;
    return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
  } catch {
    return null;
  }
};

const buildAmadeusProvider = async (): Promise<{
  provider: FlightProvider | null;
  source: CredsSource;
  clientIdMasked: string | null;
}> => {
  if (offline) return { provider: null, source: "none", clientIdMasked: null };
  const fromEnv = amadeusFromEnv();
  if (fromEnv !== null) {
    const envId = process.env["TP_SCROLL_AMADEUS_CLIENT_ID"] ?? "";
    return { provider: fromEnv, source: "env", clientIdMasked: maskClientId(envId) };
  }
  const fromFile = await loadCredsFromFile();
  if (fromFile !== null) {
    return {
      provider: new AmadeusFlightProvider(fromFile),
      source: "file",
      clientIdMasked: maskClientId(fromFile.clientId),
    };
  }
  return { provider: null, source: "none", clientIdMasked: null };
};

const maskClientId = (id: string): string => {
  if (id.length <= 4) return "•".repeat(id.length);
  return `${id.slice(0, 2)}${"•".repeat(Math.max(0, id.length - 4))}${id.slice(-2)}`;
};

// flightState is mutable because the user can rotate credentials at runtime via
// the Settings card; we rebuild the wrapped provider rather than restart the
// whole Electron process.
const flightState: {
  provider: FlightProvider;
  source: CredsSource;
  clientIdMasked: string | null;
} = {
  provider: new CachingFlightProvider(new MockFlightProvider()),
  source: "none",
  clientIdMasked: null,
};

const refreshFlightProvider = async (): Promise<void> => {
  const { provider, source, clientIdMasked } = await buildAmadeusProvider();
  flightState.provider = new CachingFlightProvider(provider ?? new MockFlightProvider());
  flightState.source = source;
  flightState.clientIdMasked = clientIdMasked;
};

// Best-effort initial load. Failures simply leave the mock provider in place.
void refreshFlightProvider();

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

  ipcMain.handle("holidays:forCountry", async (_, cc: string, year: number) => {
    try {
      const result = await holidayProvider.forCountry(cc, year);
      console.log(`[ipc] holidays:forCountry(${cc}, ${year}) → ${result.length} holidays`);
      return result;
    } catch (err) {
      console.error(`[ipc] holidays:forCountry(${cc}, ${year}) FAILED:`, err);
      return [];
    }
  });

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

  ipcMain.handle("flights:providerName", () => flightState.provider.name);
  ipcMain.handle(
    "flights:annotate",
    async (_, req: { plan: TripPlan; origin: string; destination: string }) => {
      return annotatePlan({
        plan: req.plan,
        provider: flightState.provider,
        origin: req.origin,
        destination: req.destination,
      });
    },
  );

  ipcMain.handle("flights:credentials:status", () => ({
    source: flightState.source,
    clientIdMasked: flightState.clientIdMasked,
    providerName: flightState.provider.name,
    offline,
  }));

  ipcMain.handle(
    "flights:credentials:set",
    async (_, req: { clientId: string; clientSecret: string }) => {
      const clientId = String(req.clientId ?? "").trim();
      const clientSecret = String(req.clientSecret ?? "").trim();
      if (clientId.length === 0 || clientSecret.length === 0) {
        throw new Error("clientId and clientSecret are required");
      }
      if (process.env["TP_SCROLL_AMADEUS_CLIENT_ID"] !== undefined) {
        throw new Error(
          "env-var credentials take precedence; unset TP_SCROLL_AMADEUS_CLIENT_ID to use UI credentials",
        );
      }
      await mkdir(dataDir, { recursive: true });
      await writeFile(
        flightsCredsFile,
        JSON.stringify({ clientId, clientSecret }, null, 2),
        { encoding: "utf-8", mode: 0o600 },
      );
      await refreshFlightProvider();
      return {
        source: flightState.source,
        clientIdMasked: flightState.clientIdMasked,
        providerName: flightState.provider.name,
      };
    },
  );

  ipcMain.handle("flights:credentials:clear", async () => {
    try {
      await writeFile(flightsCredsFile, JSON.stringify({}), "utf-8");
    } catch {
      // ignore — file may not exist
    }
    await refreshFlightProvider();
    return {
      source: flightState.source,
      clientIdMasked: flightState.clientIdMasked,
      providerName: flightState.provider.name,
    };
  });
};
