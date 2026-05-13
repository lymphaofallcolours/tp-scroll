import { MockFlightProvider, annotatePlan } from "@tp-scroll/adapter-flights";

import type { TpScrollApi } from "./types.js";

// When the renderer runs outside Electron (vitest, vite preview), bridge calls
// fall back to local stubs. Flights specifically run through the same
// MockFlightProvider the main process would use when no Amadeus creds are
// configured, so the demo UI still paints prices.
const stubFlightProvider = new MockFlightProvider();

const stubBridge: TpScrollApi = {
  sessions: {
    list: async () => [],
    load: async () => {
      throw new Error("no bridge — running outside Electron");
    },
    save: async () => undefined,
    delete: async () => undefined,
  },
  active: {
    get: async () => null,
    set: async () => undefined,
  },
  holidays: {
    forCountry: async () => [],
  },
  optimizer: {
    run: async () => [],
  },
  clock: {
    today: async () => 0,
  },
  flights: {
    providerName: async () => "mock",
    annotate: async (req) =>
      annotatePlan({
        plan: req.plan,
        provider: stubFlightProvider,
        origin: req.origin,
        destination: req.destination,
      }),
    credentials: {
      status: async () => ({
        source: "none" as const,
        clientIdMasked: null,
        providerName: "mock",
      }),
      set: async () => ({
        source: "none" as const,
        clientIdMasked: null,
        providerName: "mock",
      }),
      clear: async () => ({
        source: "none" as const,
        clientIdMasked: null,
        providerName: "mock",
      }),
    },
  },
};

export const bridge: TpScrollApi =
  typeof window !== "undefined" && window.tpScrollApi
    ? window.tpScrollApi
    : stubBridge;
