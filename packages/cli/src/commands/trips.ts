import { randomUUID } from "node:crypto";

import { currentSchengenLoad, dayIntFromIso, isoFromDayInt, type Trip } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { renderTable } from "../format/table.js";
import { requireActiveSession, saveAndTouch } from "./_helpers.js";

export const registerTripsCommands = (program: Command, deps: CliDeps): void => {
  const trips = program.command("trips").description("Manage trips");

  trips
    .command("add")
    .description("Add an actual trip to the active session")
    .requiredOption("--from <date>", "Departure date YYYY-MM-DD")
    .requiredOption("--to <date>", "Return date YYYY-MM-DD")
    .option("--planned", "Add as planned (default: actual)")
    .option("--note <note>", "Optional note")
    .option("--bucket <id>", "Bucket to charge (default: first bucket)")
    .action(
      async (opts: {
        from: string;
        to: string;
        planned?: boolean;
        note?: string;
        bucket?: string;
      }) => {
        const session = await requireActiveSession(deps);
        const bucketId = opts.bucket ?? session.buckets[0]!.id;
        if (!session.buckets.some((b) => b.id === bucketId)) {
          throw new Error(`unknown bucket: ${bucketId}`);
        }
        const trip: Trip = {
          id: randomUUID().slice(0, 8),
          departure: dayIntFromIso(opts.from),
          return: dayIntFromIso(opts.to),
          bucketId,
          isActual: !opts.planned,
          dayOverrides: [],
          ...(opts.note !== undefined ? { notes: opts.note } : {}),
        };
        const next = { ...session, trips: [...session.trips, trip] };
        await saveAndTouch(deps, next);
        deps.stdout(`Added trip ${trip.id}: ${opts.from} → ${opts.to} (bucket ${bucketId})`);

        if (session.schengen?.enabled) {
          const watch = session.schengen;
          const today = deps.clock.today();
          const loadAfter = currentSchengenLoad({
            trips: next.trips,
            residenceCountry: next.residenceCountry,
            homeCountry: next.homeCountry,
            today,
            windowDays: watch.windowDays,
            session: next,
          });
          if (loadAfter > watch.maxDaysInWindow) {
            deps.stdout(
              `⚠️  Schengen: this trip pushes the trailing ${watch.windowDays}d window to ${loadAfter} outside-Schengen days (cap ${watch.maxDaysInWindow})`,
            );
          }
        }
      },
    );

  trips
    .command("list")
    .description("List trips on the active session")
    .action(async () => {
      const session = await requireActiveSession(deps);
      if (session.trips.length === 0) {
        deps.stdout("(no trips)");
        return;
      }
      const rows = session.trips
        .slice()
        .sort((a, b) => a.departure - b.departure)
        .map((t) => [
          t.id,
          isoFromDayInt(t.departure),
          isoFromDayInt(t.return),
          t.isActual ? "actual" : "planned",
          t.notes ?? "",
        ]);
      deps.stdout(renderTable(["id", "from", "to", "kind", "note"], rows));
    });
};
