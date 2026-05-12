import {
  computeBalance,
  computeTripCost,
  evaluateSchengenWindow,
} from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { requireActiveSession } from "./_helpers.js";

export const registerStatusCommand = (program: Command, deps: CliDeps): void => {
  program
    .command("status")
    .description("Show consumed, remaining, and Schengen status for the active session")
    .action(async () => {
      const session = await requireActiveSession(deps);
      const cycleYear = new Date().getUTCFullYear();
      const holidays = await deps.holidayProvider.forCountry(session.residenceCountry, cycleYear);
      const holidaySet = new Set(holidays.map((h) => h.day));

      const consumed = session.trips
        .filter((t) => t.isActual)
        .reduce((s, t) => s + computeTripCost(t, session, holidaySet).leaveCost, 0);

      const balance = computeBalance({
        bucketTotal: session.cycle.totalDays,
        consumed,
        cycle: session.cycle,
      });

      deps.stdout(`Session:   ${session.name} (${session.id})`);
      deps.stdout(`Cycle:     ${session.cycle.kind}, ${session.cycle.totalDays} days`);
      deps.stdout(`Consumed:  ${balance.consumed}`);
      deps.stdout(`Remaining: ${balance.remaining}`);
      deps.stdout(`Available: ${balance.available} (after ${balance.buffer}d buffer)`);

      if (session.schengen?.enabled) {
        const result = evaluateSchengenWindow({
          trips: session.trips,
          residenceCountry: session.residenceCountry,
          homeCountry: session.homeCountry,
          range: { start: session.cycle.start, end: session.cycle.end },
          session,
          watch: session.schengen,
        });
        deps.stdout(`Schengen:  max ${result.maxInWindow} outside days in any 180-day window`);
        if (result.violatedOn.length > 0) {
          deps.stdout(`           ⚠️  ${result.violatedOn.length} day(s) exceed the 90-day cap`);
        }
      }
    });
};
