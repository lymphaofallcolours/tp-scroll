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
  TravelpayoutsFlightProvider,
  annotatePlan,
  travelpayoutsFromEnv,
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
type StoredCreds = { readonly token: string; readonly currency?: string };

/**
 * Read the on-disk flight credentials. Returns null when the file is absent,
 * unreadable, or in the legacy Amadeus shape — in the last case we log a
 * one-shot warning so the user knows why their old credentials silently
 * stopped applying. No auto-migration: there's no path from a client_id pair
 * to a Travelpayouts token.
 */
let warnedAboutLegacyCreds = false;
const loadCredsFromFile = async (): Promise<StoredCreds | null> => {
  try {
    const raw = await readFile(flightsCredsFile, "utf-8");
    const parsed = JSON.parse(raw) as {
      token?: unknown;
      currency?: unknown;
      clientId?: unknown;
      clientSecret?: unknown;
    };
    // Legacy Amadeus shape — log once and treat as "no credentials".
    if (
      (typeof parsed.clientId === "string" || typeof parsed.clientSecret === "string") &&
      typeof parsed.token !== "string"
    ) {
      if (!warnedAboutLegacyCreds) {
        warnedAboutLegacyCreds = true;
        console.warn(
          "[ipc] flights.json: legacy Amadeus shape detected and ignored — " +
            "please re-enter your Travelpayouts token in the Sessions tab",
        );
      }
      return null;
    }
    if (typeof parsed.token !== "string" || parsed.token.length === 0) return null;
    const out: StoredCreds = { token: parsed.token };
    if (typeof parsed.currency === "string" && parsed.currency.length > 0) {
      return { ...out, currency: parsed.currency };
    }
    return out;
  } catch {
    return null;
  }
};

const maskToken = (token: string): string => {
  if (token.length <= 4) return "•".repeat(token.length);
  return `${token.slice(0, 2)}${"•".repeat(Math.max(0, token.length - 4))}${token.slice(-2)}`;
};

const buildTravelpayoutsProvider = async (): Promise<{
  provider: FlightProvider | null;
  source: CredsSource;
  tokenMasked: string | null;
}> => {
  if (offline) return { provider: null, source: "none", tokenMasked: null };
  const fromEnv = travelpayoutsFromEnv();
  if (fromEnv !== null) {
    const envToken = process.env["TP_SCROLL_TRAVELPAYOUTS_TOKEN"] ?? "";
    return { provider: fromEnv, source: "env", tokenMasked: maskToken(envToken) };
  }
  const fromFile = await loadCredsFromFile();
  if (fromFile !== null) {
    return {
      provider: new TravelpayoutsFlightProvider(fromFile),
      source: "file",
      tokenMasked: maskToken(fromFile.token),
    };
  }
  return { provider: null, source: "none", tokenMasked: null };
};

// flightState is mutable because the user can rotate credentials at runtime
// via the Settings card; we rebuild the wrapped provider rather than restart
// the whole Electron process.
const flightState: {
  provider: FlightProvider;
  source: CredsSource;
  tokenMasked: string | null;
} = {
  provider: new CachingFlightProvider(new MockFlightProvider()),
  source: "none",
  tokenMasked: null,
};

const refreshFlightProvider = async (): Promise<void> => {
  const { provider, source, tokenMasked } = await buildTravelpayoutsProvider();
  flightState.provider = new CachingFlightProvider(provider ?? new MockFlightProvider());
  flightState.source = source;
  flightState.tokenMasked = tokenMasked;
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
    tokenMasked: flightState.tokenMasked,
    providerName: flightState.provider.name,
    offline,
  }));

  ipcMain.handle(
    "flights:credentials:set",
    async (_, req: { token: string; currency?: string }) => {
      const token = String(req.token ?? "").trim();
      if (token.length === 0) {
        throw new Error("token is required");
      }
      if (process.env["TP_SCROLL_TRAVELPAYOUTS_TOKEN"] !== undefined) {
        throw new Error(
          "env-var credentials take precedence; unset TP_SCROLL_TRAVELPAYOUTS_TOKEN to use UI credentials",
        );
      }
      const currency = typeof req.currency === "string" ? req.currency.trim() : "";
      await mkdir(dataDir, { recursive: true });
      const payload: { token: string; currency?: string } = { token };
      if (currency.length > 0) payload.currency = currency;
      await writeFile(
        flightsCredsFile,
        JSON.stringify(payload, null, 2),
        { encoding: "utf-8", mode: 0o600 },
      );
      await refreshFlightProvider();
      return {
        source: flightState.source,
        tokenMasked: flightState.tokenMasked,
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
      tokenMasked: flightState.tokenMasked,
      providerName: flightState.provider.name,
    };
  });
};
