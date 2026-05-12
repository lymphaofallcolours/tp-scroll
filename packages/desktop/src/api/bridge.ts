import type { TpScrollApi } from "./types.js";

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
};

export const bridge: TpScrollApi =
  typeof window !== "undefined" && window.tpScrollApi
    ? window.tpScrollApi
    : stubBridge;
