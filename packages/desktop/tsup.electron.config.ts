import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
  },
  format: ["esm"],
  outDir: "dist/electron",
  target: "node22",
  platform: "node",
  external: ["electron"],
  noExternal: [/^@tp-scroll\//],
  clean: true,
  sourcemap: true,
  dts: false,
});
