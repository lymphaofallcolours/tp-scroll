import { isoFromDayInt, optimize } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { renderTable } from "../format/table.js";
import { requireActiveSession } from "./_helpers.js";

export const registerPlanCommand = (program: Command, deps: CliDeps): void => {
  program
    .command("plan")
    .description("Run the optimizer and print the top plans")
    .option("--top <n>", "Number of plans to show", "5")
    .option(
      "--diverse [seeds]",
      "Use multi-seed search for cross-cluster diversity (default 5 seeds)",
    )
    .action(async (opts: { top: string; diverse?: string | boolean }) => {
      const session = await requireActiveSession(deps);
      const cycleYear = new Date().getUTCFullYear();
      const holidays = await deps.holidayProvider.forCountry(session.residenceCountry, cycleYear);
      const holidaySet = new Set(holidays.map((h) => h.day));

      const seedCount =
        opts.diverse === undefined
          ? 1
          : opts.diverse === true
            ? 5
            : Math.max(1, Number(opts.diverse));

      const plans = optimize(session, {
        clock: deps.clock,
        holidays: holidaySet,
        topK: Number(opts.top),
        seedCount,
      });

      if (plans.length === 0) {
        deps.stdout("(no plans found)");
        return;
      }

      deps.stdout(`Top ${plans.length} plan(s) (lexicographic: home days → leverage → anchors → trip count):`);
      deps.stdout("");
      const rows = plans.map((p, i) => [
        `#${i + 1}`,
        String(p.awayDaysTotal),
        String(p.leaveCostTotal),
        String(p.tripCount),
        String(p.anchorCoverage),
      ]);
      deps.stdout(renderTable(["rank", "home days", "leave cost", "trips", "anchors"], rows));

      plans.forEach((p, i) => {
        deps.stdout("");
        deps.stdout(`Plan #${i + 1} trips:`);
        if (p.trips.length === 0) {
          deps.stdout("  (none)");
          return;
        }
        const tripRows = p.trips
          .slice()
          .sort((a, b) => a.departure - b.departure)
          .map((t) => [isoFromDayInt(t.departure), isoFromDayInt(t.return)]);
        deps.stdout(
          tripRows.map((r) => `  ${r[0]} → ${r[1]}`).join("\n"),
        );
      });
    });
};
