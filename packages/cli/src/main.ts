import { Command } from "commander";

import type { CliDepsBase } from "./wiring.js";
import { registerAnchorsCommands } from "./commands/anchors.js";
import { registerBlockedCommands } from "./commands/blocked.js";
import { registerCycleCommands } from "./commands/cycle.js";
import { registerPlanCommand } from "./commands/plan.js";
import { registerSessionCommands } from "./commands/session.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerTripsCommands } from "./commands/trips.js";

export type CliDeps = CliDepsBase & {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

export const main = async (argv: string[], deps: CliDeps): Promise<number> => {
  const program = new Command()
    .name("tp-scroll")
    .description("Optimize annual leave around weekends and public holidays")
    .exitOverride()
    .configureOutput({
      writeOut: (s) => deps.stdout(s.replace(/\n$/, "")),
      writeErr: (s) => deps.stderr(s.replace(/\n$/, "")),
    });

  registerSessionCommands(program, deps);
  registerCycleCommands(program, deps);
  registerTripsCommands(program, deps);
  registerBlockedCommands(program, deps);
  registerAnchorsCommands(program, deps);
  registerStatusCommand(program, deps);
  registerPlanCommand(program, deps);

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (err) {
    if (err && typeof err === "object" && "exitCode" in err) {
      const code = (err as { exitCode: number }).exitCode;
      if (typeof code === "number" && code !== 0) return code;
      return code === 0 ? 0 : 1;
    }
    deps.stderr(err instanceof Error ? err.message : String(err));
    return 1;
  }
};
