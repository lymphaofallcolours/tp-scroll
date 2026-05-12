import type { Session } from "@tp-scroll/core";

import type { CliDeps } from "../main.js";

export const requireActiveSession = async (deps: CliDeps): Promise<Session> => {
  const id = await deps.active.load();
  if (id === undefined) {
    throw new Error("no active session — create one with `tp-scroll session new` first");
  }
  return deps.store.load(id);
};

export const saveAndTouch = async (deps: CliDeps, session: Session): Promise<void> => {
  const updated: Session = { ...session, updatedAt: new Date().toISOString() };
  await deps.store.save(updated);
};
