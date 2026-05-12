import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TmpHome = {
  readonly path: string;
  cleanup(): Promise<void>;
};

export const makeTmpHome = async (): Promise<TmpHome> => {
  const path = await mkdtemp(join(tmpdir(), "tp-scroll-test-"));
  return {
    path,
    cleanup: () => rm(path, { recursive: true, force: true }),
  };
};
