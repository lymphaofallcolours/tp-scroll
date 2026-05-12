import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { z } from "zod";

const ActiveFileSchema = z.object({ id: z.string().min(1) });

export type ActiveSession = {
  load(): Promise<string | undefined>;
  set(id: string): Promise<void>;
};

export const makeActiveSession = (filePath: string): ActiveSession => ({
  async load() {
    try {
      const raw = await readFile(filePath, "utf-8");
      return ActiveFileSchema.parse(JSON.parse(raw)).id;
    } catch {
      return undefined;
    }
  },
  async set(id: string) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ id }), "utf-8");
  },
});
