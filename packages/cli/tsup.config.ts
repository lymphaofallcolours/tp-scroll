import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  dts: false,
  noExternal: [/^@tp-scroll\//],
  banner: { js: "#!/usr/bin/env node" },
});
