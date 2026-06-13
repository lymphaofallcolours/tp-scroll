import { defineConfig } from "tsup";

// Bundle every dependency EXCEPT electron (and node builtins, which esbuild
// externalises automatically for platform: "node"). A catch-all /.*/ would also
// match "electron" — and because tsup's noExternal overrides external, that
// pulls Electron's CommonJS index.js into the ESM bundle, where esbuild's
// require() shim throws "Dynamic require of \"fs\" is not supported" at startup.
const BUNDLE_EVERYTHING_EXCEPT_ELECTRON = /^(?!electron(\/|$)).+/;

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
    // Make the packaged app self-contained — electron-builder ships only dist/
    // with no node_modules, so third-party runtime deps (zod, date-holidays)
    // must be inlined here. date-holidays inlines its JSON dataset when bundled.
    external: ["electron"],
    noExternal: [BUNDLE_EVERYTHING_EXCEPT_ELECTRON],
    // Some bundled CJS deps (graceful-fs / fs-extra via electron-updater) call
    // require("fs") at load time. In an ESM bundle `require` is undefined, so
    // esbuild's shim throws "Dynamic require of \"fs\" is not supported". Inject
    // a real require built from import.meta.url so those calls resolve.
    banner: {
      js: "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
    },
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
