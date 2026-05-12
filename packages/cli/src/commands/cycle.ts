import { dayIntFromIso, rollCycle, type LeaveBucket, type LeaveCycle } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { requireActiveSession, saveAndTouch } from "./_helpers.js";

type CycleSetOpts = {
  kind?: "calendar" | "fiscal" | "anniversary";
  totalDays?: string;
  carryover?: "lose" | "cumulative";
  maxCarryover?: string;
  bufferAtEnd?: string;
  bookingHorizon?: string;
};

export const registerCycleCommands = (program: Command, deps: CliDeps): void => {
  const cycle = program.command("cycle").description("Manage the leave cycle");

  cycle
    .command("set")
    .description("Set or update the cycle config on the active session")
    .option("--kind <kind>", "calendar | fiscal | anniversary")
    .option("--total-days <n>", "Total leave days in the cycle")
    .option("--carryover <mode>", "lose | cumulative")
    .option("--max-carryover <n>", "Max carryover days (cumulative)")
    .option("--buffer-at-end <n>", "Days reserved at end of cycle")
    .option("--booking-horizon <n>", "Booking horizon in days")
    .action(async (opts: CycleSetOpts) => {
      const session = await requireActiveSession(deps);
      const cycle = { ...session.cycle };
      if (opts.kind) cycle.kind = opts.kind;
      if (opts.totalDays) cycle.totalDays = Number(opts.totalDays);
      if (opts.carryover === "lose") cycle.carryover = { mode: "lose" };
      else if (opts.carryover === "cumulative") {
        cycle.carryover = {
          mode: "cumulative",
          maxDays: Number(opts.maxCarryover ?? "0"),
        };
      }
      if (opts.bufferAtEnd) cycle.bufferAtEnd = Number(opts.bufferAtEnd);
      if (opts.bookingHorizon) cycle.bookingHorizonDays = Number(opts.bookingHorizon);

      const bucketTotal = opts.totalDays ? Number(opts.totalDays) : session.buckets[0]!.totalDays;
      const buckets = [{ ...session.buckets[0]!, totalDays: bucketTotal }];

      await saveAndTouch(deps, { ...session, cycle, buckets });
      deps.stdout(`Cycle updated: ${cycle.kind}, total ${cycle.totalDays}, carryover ${cycle.carryover.mode}`);
    });

  cycle
    .command("roll")
    .description("Archive the current cycle and open a new one")
    .requiredOption("--id <id>", "New cycle id (e.g. 2027)")
    .requiredOption("--name <name>", "New cycle name")
    .requiredOption("--from <date>", "New cycle start YYYY-MM-DD")
    .requiredOption("--to <date>", "New cycle end YYYY-MM-DD")
    .requiredOption("--total-days <n>", "New cycle total leave days")
    .action(async (opts: { id: string; name: string; from: string; to: string; totalDays: string }) => {
      const session = await requireActiveSession(deps);
      const newCycle: LeaveCycle = {
        ...session.cycle,
        id: opts.id,
        name: opts.name,
        start: dayIntFromIso(opts.from),
        end: dayIntFromIso(opts.to),
        totalDays: Number(opts.totalDays),
      };
      const newBuckets: LeaveBucket[] = [
        {
          id: "annual",
          name: "annual",
          cycleId: opts.id,
          totalDays: Number(opts.totalDays),
        },
      ];
      const rolled = rollCycle(session, newCycle, newBuckets);
      await saveAndTouch(deps, rolled);
      deps.stdout(`Rolled to cycle ${opts.id} (${opts.name}). Previous cycle archived in history.`);
    });
};
