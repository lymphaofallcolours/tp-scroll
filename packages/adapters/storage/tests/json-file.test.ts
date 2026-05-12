import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultSession } from "@tp-scroll/core";

import { JsonFileSessionStore } from "../src/json-file.js";
import { makeTmpHome, type TmpHome } from "./tmp-home.js";

describe("JsonFileSessionStore — file-system specifics", () => {
  let home: TmpHome;
  let store: JsonFileSessionStore;

  beforeEach(async () => {
    home = await makeTmpHome();
    store = new JsonFileSessionStore({ baseDir: home.path });
  });
  afterEach(() => home.cleanup());

  it("save() leaves no .tmp file behind after success", async () => {
    const s = defaultSession({ id: "atomic", name: "a", residenceCountry: "DE", homeCountry: "ES" });
    await store.save(s);
    const files = await readdir(home.path);
    expect(files).toEqual(["atomic.json"]);
  });

  it("save() writes valid JSON that round-trips through SessionSchema", async () => {
    const s = defaultSession({
      id: "rt",
      name: "Round trip",
      residenceCountry: "DE",
      homeCountry: "ES",
    });
    await store.save(s);
    const raw = await readFile(join(home.path, "rt.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe("rt");
    expect(parsed.residenceCountry).toBe("DE");
  });

  it("load() refuses a corrupted file with a clear error", async () => {
    await writeFile(join(home.path, "broken.json"), "{ not valid json", "utf-8");
    await expect(store.load("broken")).rejects.toThrow(/corrupt|parse|invalid/i);
  });

  it("load() refuses a file whose content fails Zod validation", async () => {
    await writeFile(
      join(home.path, "bad.json"),
      JSON.stringify({ id: "bad", residenceCountry: "X" }), // missing fields, bad country code
      "utf-8",
    );
    await expect(store.load("bad")).rejects.toThrow();
  });

  it("creates the baseDir on demand", async () => {
    const subDir = join(home.path, "nested", "sessions");
    const nestedStore = new JsonFileSessionStore({ baseDir: subDir });
    await nestedStore.save(
      defaultSession({ id: "n", name: "n", residenceCountry: "DE", homeCountry: "ES" }),
    );
    const files = await readdir(subDir);
    expect(files).toContain("n.json");
  });

  it("delete() is a no-op for an unknown id", async () => {
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  it("rejects ids that would escape the baseDir (path traversal)", async () => {
    await expect(
      store.save(
        defaultSession({
          id: "../escape",
          name: "x",
          residenceCountry: "DE",
          homeCountry: "ES",
        }),
      ),
    ).rejects.toThrow(/invalid id/i);
  });
});
