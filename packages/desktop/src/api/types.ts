/**
 * Mirrors the IPC contract exposed by electron/preload.ts.
 *
 * The renderer can only reach core/adapters via this typed surface. Keep this
 * file in sync with electron/ipc.ts — both compile from the same source of
 * truth here.
 */
import type {
  DayInt,
  OptimizeOptions,
  Session,
  TripPlan,
} from "@tp-scroll/core";
import type { Holiday } from "@tp-scroll/adapter-holidays";
import type { SessionSummary } from "@tp-scroll/adapter-storage";

export type OptimizeRequest = Omit<OptimizeOptions, "clock" | "holidays"> & {
  readonly sessionId: string;
  readonly holidayYear?: number;
};

export type TpScrollApi = {
  readonly sessions: {
    list(): Promise<ReadonlyArray<SessionSummary>>;
    load(id: string): Promise<Session>;
    save(session: Session): Promise<void>;
    delete(id: string): Promise<void>;
  };
  readonly active: {
    get(): Promise<string | null>;
    set(id: string): Promise<void>;
  };
  readonly holidays: {
    forCountry(countryCode: string, year: number): Promise<ReadonlyArray<Holiday>>;
  };
  readonly optimizer: {
    run(req: OptimizeRequest): Promise<ReadonlyArray<TripPlan>>;
  };
  readonly clock: {
    today(): Promise<DayInt>;
  };
};

declare global {
  interface Window {
    readonly tpScrollApi: TpScrollApi;
  }
}
