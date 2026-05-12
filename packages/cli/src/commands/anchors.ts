import { dayIntFromIso } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { requireActiveSession, saveAndTouch } from "./_helpers.js";

export const registerAnchorsCommands = (program: Command, deps: CliDeps): void => {
  const anchors = program.command("anchors").description("Manage anchor dates");

  anchors
    .command("add")
    .description("Add an anchor date (preference for home or residence)")
    .requiredOption("--day <date>", "Anchor date YYYY-MM-DD")
    .requiredOption("--prefer <where>", "home | residence")
    .option("--weight <n>", "Weight (positive number)", "1")
    .action(async (opts: { day: string; prefer: "home" | "residence"; weight: string }) => {
      const session = await requireActiveSession(deps);
      const anchor = {
        day: dayIntFromIso(opts.day),
        preferIn: opts.prefer,
        weight: Number(opts.weight),
      };
      await saveAndTouch(deps, { ...session, anchors: [...session.anchors, anchor] });
      deps.stdout(`Added anchor ${opts.day} prefer=${opts.prefer} weight=${anchor.weight}`);
    });
};
