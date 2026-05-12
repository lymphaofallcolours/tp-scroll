import { join } from "node:path";

import { SystemClock, NoopLogger, type Clock, type Logger } from "@tp-scroll/core";
import {
  DateHolidaysProvider,
  FallbackHolidayProvider,
  NagerHolidayProvider,
  type HolidayProvider,
} from "@tp-scroll/adapter-holidays";
import { JsonFileSessionStore, type SessionStore } from "@tp-scroll/adapter-storage";

import { makeActiveSession, type ActiveSession } from "./active.js";

export type CliDepsBase = {
  store: SessionStore;
  active: ActiveSession;
  holidayProvider: HolidayProvider;
  clock: Clock;
  logger: Logger;
};

export const makeDataPaths = (home: string) => ({
  dataDir: join(home, ".tp-scroll"),
  sessionsDir: join(home, ".tp-scroll", "sessions"),
  activeFile: join(home, ".tp-scroll", "active.json"),
});

export const makeDeps = (home: string): CliDepsBase => {
  const paths = makeDataPaths(home);
  return {
    store: new JsonFileSessionStore({ baseDir: paths.sessionsDir }),
    active: makeActiveSession(paths.activeFile),
    holidayProvider: new FallbackHolidayProvider(new NagerHolidayProvider(), new DateHolidaysProvider()),
    clock: SystemClock,
    logger: NoopLogger,
  };
};

export const makeOfflineDeps = (home: string): CliDepsBase => {
  const paths = makeDataPaths(home);
  return {
    store: new JsonFileSessionStore({ baseDir: paths.sessionsDir }),
    active: makeActiveSession(paths.activeFile),
    holidayProvider: new DateHolidaysProvider(),
    clock: SystemClock,
    logger: NoopLogger,
  };
};
