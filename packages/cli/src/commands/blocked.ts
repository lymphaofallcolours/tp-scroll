import { dayIntFromIso } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { requireActiveSession, saveAndTouch } from "./_helpers.js";

export const registerBlockedCommands = (program: Command, deps: CliDeps): void => {
  const blocked = program.command("blocked").description("Manage blocked periods");

  blocked
    .command("add")
    .description("Mark a date range as blocked (no trips may overlap)")
    .requiredOption("--from <date>", "Start date YYYY-MM-DD")
    .requiredOption("--to <date>", "End date YYYY-MM-DD")
    .requiredOption("--reason <reason>", "Why this range is blocked")
    .action(async (opts: { from: string; to: string; reason: string }) => {
      const session = await requireActiveSession(deps);
      const block = {
        start: dayIntFromIso(opts.from),
        end: dayIntFromIso(opts.to),
        reason: opts.reason,
      };
      await saveAndTouch(deps, { ...session, blocked: [...session.blocked, block] });
      deps.stdout(`Blocked ${opts.from} → ${opts.to} (${opts.reason})`);
    });
};
