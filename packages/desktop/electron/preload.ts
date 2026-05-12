import { contextBridge, ipcRenderer } from "electron";

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api = {
  sessions: {
    list: () => invoke("sessions:list"),
    load: (id: string) => invoke("sessions:load", id),
    save: (session: unknown) => invoke("sessions:save", session),
    delete: (id: string) => invoke("sessions:delete", id),
  },
  active: {
    get: () => invoke("active:get"),
    set: (id: string) => invoke("active:set", id),
  },
  holidays: {
    forCountry: (countryCode: string, year: number) =>
      invoke("holidays:forCountry", countryCode, year),
  },
  optimizer: {
    run: (req: unknown) => invoke("optimizer:run", req),
  },
  clock: {
    today: () => invoke("clock:today"),
  },
  flights: {
    providerName: () => invoke("flights:providerName"),
    annotate: (req: unknown) => invoke("flights:annotate", req),
  },
};

contextBridge.exposeInMainWorld("tpScrollApi", api);
