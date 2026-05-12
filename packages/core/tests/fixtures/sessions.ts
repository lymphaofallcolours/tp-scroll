import { type Session } from "../../src/session/session.js";
import { defaultSession } from "../../src/session/defaults.js";
import { type Trip } from "../../src/trips/trip.js";

export const makeSession = (overrides: Partial<Session> = {}): Session => ({
  ...defaultSession({
    id: "s-test",
    name: "Test session",
    residenceCountry: "DE",
    homeCountry: "ES",
  }),
  ...overrides,
});

export const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: "t-test",
  departure: 9500,
  return: 9510,
  bucketId: "annual",
  isActual: false,
  dayOverrides: [],
  ...overrides,
});
