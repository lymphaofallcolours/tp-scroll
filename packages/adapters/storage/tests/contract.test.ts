import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultSession, type Session } from "@tp-scroll/core";

import { JsonFileSessionStore } from "../src/json-file.js";
import type { SessionStore } from "../src/store.js";
import { makeTmpHome, type TmpHome } from "./tmp-home.js";

const newSession = (id: string): Session => ({
  ...defaultSession({ id, name: `session-${id}`, residenceCountry: "DE", homeCountry: "ES" }),
});

const runContract = (label: string, factory: (home: TmpHome) => SessionStore) => {
  describe(`SessionStore contract — ${label}`, () => {
    let home: TmpHome;
    let store: SessionStore;

    beforeEach(async () => {
      home = await makeTmpHome();
      store = factory(home);
    });
    afterEach(() => home.cleanup());

    it("list() returns empty initially", async () => {
      expect(await store.list()).toEqual([]);
    });

    it("save() then load() returns an equivalent session", async () => {
      const s = newSession("s1");
      await store.save(s);
      const loaded = await store.load("s1");
      expect(loaded.id).toBe(s.id);
      expect(loaded.name).toBe(s.name);
      expect(loaded.residenceCountry).toBe(s.residenceCountry);
    });

    it("list() reports a summary for each saved session", async () => {
      await store.save(newSession("a"));
      await store.save(newSession("b"));
      const summaries = await store.list();
      const ids = summaries.map((s) => s.id).sort();
      expect(ids).toEqual(["a", "b"]);
    });

    it("save() overwrites an existing session with the same id", async () => {
      await store.save(newSession("x"));
      const updated = { ...newSession("x"), name: "renamed" };
      await store.save(updated);
      const loaded = await store.load("x");
      expect(loaded.name).toBe("renamed");
    });

    it("delete() removes the session", async () => {
      await store.save(newSession("d"));
      await store.delete("d");
      expect(await store.list()).toEqual([]);
      await expect(store.load("d")).rejects.toThrow();
    });

    it("load() throws a clear error for unknown id", async () => {
      await expect(store.load("nope")).rejects.toThrow(/nope/);
    });
  });
};

runContract("JsonFileSessionStore", (home) => new JsonFileSessionStore({ baseDir: home.path }));
