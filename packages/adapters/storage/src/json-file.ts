import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { SessionSchema, type Session } from "@tp-scroll/core";

import type { SessionStore, SessionSummary } from "./store.js";

const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const assertValidId = (id: string): void => {
  if (!ID_PATTERN.test(id)) throw new Error(`invalid id: ${JSON.stringify(id)}`);
};

const fileFor = (baseDir: string, id: string): string => join(baseDir, `${id}.json`);

const tmpFor = (baseDir: string, id: string): string => join(baseDir, `${id}.json.tmp`);

export type JsonFileSessionStoreOptions = {
  readonly baseDir: string;
};

export class JsonFileSessionStore implements SessionStore {
  private readonly baseDir: string;
  private dirReady = false;

  constructor(opts: JsonFileSessionStoreOptions) {
    this.baseDir = opts.baseDir;
  }

  private async ensureDir(): Promise<void> {
    if (this.dirReady) return;
    await mkdir(this.baseDir, { recursive: true });
    this.dirReady = true;
  }

  async list(): Promise<ReadonlyArray<SessionSummary>> {
    await this.ensureDir();
    const entries = await readdir(this.baseDir);
    const summaries: SessionSummary[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const id = entry.slice(0, -".json".length);
      try {
        const session = await this.load(id);
        summaries.push({ id: session.id, name: session.name, updatedAt: session.updatedAt });
      } catch {
        // Skip corrupted/invalid files in list view — load() will surface them clearly when targeted
      }
    }
    return summaries;
  }

  async load(id: string): Promise<Session> {
    assertValidId(id);
    await this.ensureDir();
    let raw: string;
    try {
      raw = await readFile(fileFor(this.baseDir, id), "utf-8");
    } catch (cause) {
      throw new Error(`session not found: ${id}`, { cause });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new Error(`corrupt session file: ${id} (invalid JSON)`, { cause });
    }
    return SessionSchema.parse(parsed);
  }

  async save(session: Session): Promise<void> {
    assertValidId(session.id);
    await this.ensureDir();
    const target = fileFor(this.baseDir, session.id);
    const tmp = tmpFor(this.baseDir, session.id);
    const data = JSON.stringify(session, null, 2);
    await writeFile(tmp, data, "utf-8");
    await rename(tmp, target);
  }

  async delete(id: string): Promise<void> {
    assertValidId(id);
    await this.ensureDir();
    await rm(fileFor(this.baseDir, id), { force: true });
  }
}
