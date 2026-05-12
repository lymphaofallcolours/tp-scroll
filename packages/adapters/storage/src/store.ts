import type { Session } from "@tp-scroll/core";

export type SessionSummary = {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
};

export type SessionStore = {
  list(): Promise<ReadonlyArray<SessionSummary>>;
  load(id: string): Promise<Session>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
};
