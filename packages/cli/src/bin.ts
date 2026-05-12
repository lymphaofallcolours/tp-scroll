import { homedir } from "node:os";

import { main } from "./main.js";
import { makeDeps, makeOfflineDeps } from "./wiring.js";

const networkOff = process.env["TP_SCROLL_NETWORK"] === "off";
const home = process.env["HOME"] ?? homedir();

const base = networkOff ? makeOfflineDeps(home) : makeDeps(home);
const deps = {
  ...base,
  stdout: (line: string) => process.stdout.write(`${line}\n`),
  stderr: (line: string) => process.stderr.write(`${line}\n`),
};

const code = await main(process.argv.slice(2), deps);
process.exit(code);
