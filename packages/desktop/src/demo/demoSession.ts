/**
 * Beautiful first-run experience: when the user hasn't created a session yet,
 * we render this hand-crafted example so the calendar isn't an empty grid.
 * Replaced as soon as `bridge.sessions.list()` returns anything.
 */
import { dayIntFromIso, defaultSession, type Session } from "@tp-scroll/core";

const iso = dayIntFromIso;

export const buildDemoSession = (): Session => {
  const base = defaultSession({
    id: "demo",
    name: "2026 PhD year",
    residenceCountry: "DE",
    homeCountry: "ES",
  });

  return {
    ...base,
    trips: [
      {
        id: "t-easter",
        departure: iso("2026-04-03"),
        return: iso("2026-04-13"),
        bucketId: "annual",
        isActual: true,
        dayOverrides: [],
        notes: "Easter at home",
      },
      {
        id: "t-summer",
        departure: iso("2026-07-25"),
        return: iso("2026-08-15"),
        bucketId: "annual",
        isActual: true,
        dayOverrides: [],
        notes: "Summer in Spain",
      },
      {
        id: "t-christmas",
        departure: iso("2026-12-19"),
        return: iso("2027-01-04"),
        bucketId: "annual",
        isActual: false,
        dayOverrides: [],
        notes: "Christmas — planned",
      },
    ],
    blocked: [
      { start: iso("2026-09-15"), end: iso("2026-10-15"), reason: "teaching block" },
    ],
    anchors: [
      { day: iso("2026-12-24"), preferIn: "home", weight: 10 },
      { day: iso("2026-04-05"), preferIn: "home", weight: 5 },
    ],
  };
};
