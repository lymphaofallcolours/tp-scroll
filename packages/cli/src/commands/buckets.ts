import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { renderTable } from "../format/table.js";
import { requireActiveSession, saveAndTouch } from "./_helpers.js";

export const registerBucketsCommands = (program: Command, deps: CliDeps): void => {
  const buckets = program.command("buckets").description("Manage leave buckets");

  buckets
    .command("new")
    .description("Create a new bucket (sum of bucket totals must equal cycle.totalDays)")
    .requiredOption("--id <id>", "Bucket id (e.g. sick, parental)")
    .requiredOption("--name <name>", "Display name")
    .requiredOption("--total-days <n>", "Days allocated to this bucket")
    .action(async (opts: { id: string; name: string; totalDays: string }) => {
      const session = await requireActiveSession(deps);
      if (session.buckets.some((b) => b.id === opts.id)) {
        throw new Error(`bucket already exists: ${opts.id}`);
      }
      const newBucket = {
        id: opts.id,
        name: opts.name,
        cycleId: session.cycle.id,
        totalDays: Number(opts.totalDays),
      };
      await saveAndTouch(deps, {
        ...session,
        buckets: [...session.buckets, newBucket],
      });
      deps.stdout(`Added bucket ${opts.id} (${opts.name}) with ${opts.totalDays} days`);
    });

  buckets
    .command("list")
    .description("List all buckets and their per-bucket consumption")
    .action(async () => {
      const session = await requireActiveSession(deps);
      const rows = session.buckets.map((b) => [
        b.id,
        b.name,
        String(b.totalDays),
        b.cycleId,
      ]);
      deps.stdout(renderTable(["id", "name", "total", "cycle"], rows));
    });
};
