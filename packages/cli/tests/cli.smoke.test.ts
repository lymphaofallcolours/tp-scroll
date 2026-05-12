import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FixedClock, dayIntFromIso } from "@tp-scroll/core";

import { main, type CliDeps } from "../src/main.js";
import { makeOfflineDeps } from "../src/wiring.js";

describe("CLI smoke — end-to-end", () => {
  let tmpHome: string;
  let deps: CliDeps;
  let stdoutLines: string[];
  let stderrLines: string[];

  beforeEach(async () => {
    tmpHome = await mkdtemp(join(tmpdir(), "tp-scroll-cli-"));
    stdoutLines = [];
    stderrLines = [];
    deps = {
      ...(await makeOfflineDeps(tmpHome)),
      clock: FixedClock(dayIntFromIso("2025-12-15")),
      stdout: (line) => stdoutLines.push(line),
      stderr: (line) => stderrLines.push(line),
    };
  });

  afterEach(() => rm(tmpHome, { recursive: true, force: true }));

  it("runs the full new → cycle set → trips add → status → plan flow", async () => {
    expect(await main(["session", "new", "--name", "2026", "--residence", "DE", "--home", "ES"], deps)).toBe(0);
    expect(stdoutLines.join("\n")).toMatch(/created session/i);

    expect(await main(["cycle", "set", "--kind", "calendar", "--total-days", "25", "--carryover", "lose"], deps)).toBe(0);

    expect(await main(["trips", "add", "--from", "2026-04-10", "--to", "2026-04-18"], deps)).toBe(0);
    expect(await main(["trips", "list"], deps)).toBe(0);
    expect(stdoutLines.join("\n")).toMatch(/2026-04-10/);

    expect(await main(["blocked", "add", "--from", "2026-09-01", "--to", "2026-09-30", "--reason", "teaching"], deps)).toBe(0);
    expect(await main(["anchors", "add", "--day", "2026-12-24", "--prefer", "home", "--weight", "10"], deps)).toBe(0);

    stdoutLines.length = 0;
    expect(await main(["status"], deps)).toBe(0);
    const status = stdoutLines.join("\n");
    expect(status).toMatch(/consumed/i);
    expect(status).toMatch(/remaining/i);

    stdoutLines.length = 0;
    expect(await main(["plan"], deps)).toBe(0);
    const planOut = stdoutLines.join("\n");
    expect(planOut).toMatch(/plan/i);

    // The optimizer should return at least 1 plan; check for either explicit plan rows
    // or a "no plans" message (in which case our budget got eaten by the actual trip).
    const looksLikePlans = /home days/i.test(planOut) || /trips/i.test(planOut);
    expect(looksLikePlans).toBe(true);
  }, 30_000);

  it("returns a non-zero exit code for unknown commands", async () => {
    const code = await main(["session", "totally-not-a-command"], deps);
    expect(code).not.toBe(0);
  });

  it("session list returns an empty result on a fresh tmp HOME", async () => {
    expect(await main(["session", "list"], deps)).toBe(0);
    expect(stdoutLines.join("\n")).toMatch(/no sessions/i);
  });
});
