import { randomUUID } from "node:crypto";

import { defaultSession } from "@tp-scroll/core";
import type { Command } from "commander";

import type { CliDeps } from "../main.js";
import { renderTable } from "../format/table.js";

export const registerSessionCommands = (program: Command, deps: CliDeps): void => {
  const session = program.command("session").description("Manage sessions");

  session
    .command("new")
    .description("Create a new session and mark it active")
    .requiredOption("--name <name>", "Session name")
    .requiredOption("--residence <iso2>", "Residence country (ISO-3166-1 alpha-2)")
    .requiredOption("--home <iso2>", "Home country (ISO-3166-1 alpha-2)")
    .action(async (opts: { name: string; residence: string; home: string }) => {
      const id = randomUUID().slice(0, 8);
      const session = defaultSession({
        id,
        name: opts.name,
        residenceCountry: opts.residence,
        homeCountry: opts.home,
      });
      await deps.store.save(session);
      await deps.active.set(id);
      deps.stdout(`Created session ${id} (${session.name}) — now active`);
    });

  session
    .command("list")
    .description("List all sessions")
    .action(async () => {
      const summaries = await deps.store.list();
      if (summaries.length === 0) {
        deps.stdout("(no sessions)");
        return;
      }
      const activeId = await deps.active.load();
      const rows = summaries.map((s) => [
        s.id === activeId ? "*" : " ",
        s.id,
        s.name,
        s.updatedAt,
      ]);
      deps.stdout(renderTable(["", "id", "name", "updated"], rows));
    });

  session
    .command("use <id>")
    .description("Mark a session as active")
    .action(async (id: string) => {
      await deps.store.load(id); // throws if missing
      await deps.active.set(id);
      deps.stdout(`Active session: ${id}`);
    });
};
