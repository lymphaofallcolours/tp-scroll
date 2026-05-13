import { defineConfig } from "tsup";

// Two builds because Electron's sandboxed preload (webPreferences.sandbox: true)
// cannot load ESM; the renderer never sees `window.tpScrollApi` and silently
// falls back to the stub bridge, which is what made every IPC call return [].
// main.ts is a top-level Node script so ESM is fine there.
export default defineConfig([
  {
    entry: { main: "electron/main.ts" },
    format: ["esm"],
    outDir: "dist/electron",
    target: "node22",
    platform: "node",
    external: ["electron"],
    noExternal: [/^@tp-scroll\//],
    clean: true,
    sourcemap: true,
    dts: false,
  },
  {
    entry: { preload: "electron/preload.ts" },
    format: ["cjs"],
    outDir: "dist/electron",
    target: "node22",
    platform: "node",
    external: ["electron"],
    noExternal: [/^@tp-scroll\//],
    clean: false,
    sourcemap: true,
    dts: false,
    outExtension: () => ({ js: ".cjs" }),
  },
]);
