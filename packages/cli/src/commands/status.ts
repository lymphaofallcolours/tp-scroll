import {
  computeBucketBalances,
  currentSchengenLoad,
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

      const bucketBalances = computeBucketBalances(session, holidaySet);

      deps.stdout(`Session:   ${session.name} (${session.id})`);
      deps.stdout(`Cycle:     ${session.cycle.kind}, ${session.cycle.totalDays} days`);
      deps.stdout(`Buckets:`);
      for (const bb of bucketBalances) {
        deps.stdout(
          `  ${bb.bucketName.padEnd(12)} consumed ${bb.balance.consumed} / ${bb.balance.total}` +
            ` (remaining ${bb.balance.remaining}, available ${bb.balance.available} after ${bb.balance.buffer}d buffer)`,
        );
      }

      if (session.schengen?.enabled) {
        const watch = session.schengen;
        const today = deps.clock.today();
        const currentLoad = currentSchengenLoad({
          trips: session.trips,
          residenceCountry: session.residenceCountry,
          homeCountry: session.homeCountry,
          today,
          windowDays: watch.windowDays,
          session,
        });
        deps.stdout(
          `Schengen:  ${currentLoad} / ${watch.maxDaysInWindow} outside-Schengen days in the trailing ${watch.windowDays}d`,
        );

        const result = evaluateSchengenWindow({
          trips: session.trips,
          residenceCountry: session.residenceCountry,
          homeCountry: session.homeCountry,
          range: { start: session.cycle.start, end: session.cycle.end },
          session,
          watch,
        });
        deps.stdout(`           max ${result.maxInWindow} in any ${watch.windowDays}d window across the cycle`);
        if (result.violatedOn.length > 0) {
          deps.stdout(`           ⚠️  ${result.violatedOn.length} day(s) exceed the ${watch.maxDaysInWindow}d cap`);
        } else if (currentLoad > watch.maxDaysInWindow * 0.8) {
          deps.stdout(`           ⚠️  approaching the cap (>80% used)`);
        }
      }
    });
};
