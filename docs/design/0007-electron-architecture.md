# ADR 0007 — Electron architecture for v1.0

**Status:** Accepted (2026-05-13)

## Context

v1.0 ships `tp-scroll` as a desktop app. The engine (`@tp-scroll/core`), adapters (`@tp-scroll/adapter-holidays`, `@tp-scroll/adapter-storage`), and CLI (`@tp-scroll/cli`) remain unchanged. The new `@tp-scroll/desktop` package needs to host a windowed UI on macOS / Linux / Windows, talk to the same JSON-file storage and HolidayProvider the CLI uses, and stay testable.

## Decision

A standard three-process Electron layout, but with a few opinionated picks:

```
packages/desktop/
├── electron/
│   ├── main.ts        # main process — owns IO
│   ├── preload.ts     # contextBridge — exposes window.tpScrollApi
│   └── ipc.ts         # registers ipcMain handlers
└── src/               # renderer (React + Vite)
    └── api/
        ├── bridge.ts  # typed wrapper around window.tpScrollApi
        └── types.ts   # the TpScrollApi contract
```

- **Renderer**: React 18 + Vite 5. ESM-native, fast HMR, matches the existing workspace's TypeScript-strict-ESM style. No Node-only imports in the renderer process — ESLint-enforced.
- **Hardening**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. The preload's `contextBridge.exposeInMainWorld("tpScrollApi", ...)` is the only path between renderer and Node.
- **IPC contract**: a single typed object (`TpScrollApi`) defined in `src/api/types.ts` and mirrored by string-keyed handlers in `electron/ipc.ts`. Five surfaces: `sessions`, `active`, `holidays`, `optimizer`, `clock`. Every call uses `ipcRenderer.invoke` (promise-based) — no fire-and-forget channels.
- **Composition**: the main process composes the same `JsonFileSessionStore` + `FallbackHolidayProvider` (`DateHolidaysProvider` alone when `TP_SCROLL_NETWORK=off`) that the CLI uses. Single source of behavior across hosts.
- **Optimizer location**: runs in the renderer process. It's pure JS and has no Node deps, so importing `optimize` directly from `@tp-scroll/core` avoids a round-trip to the main process. The "Run" button on the Plan view is intentionally synchronous-with-spinner — it locks the renderer for the search duration, which is fine because the page has nothing else to do.
- **Renderer-side bridge fallback**: when `window.tpScrollApi` is undefined (e.g. running in vitest with jsdom), `bridge.ts` returns a stub that no-ops storage and returns empty lists. Component tests don't need Electron.

## Alternatives rejected

- **Tauri** — smaller binary, but the prompt explicitly named Electron and the ecosystem of `react-chartjs-2` etc. is more mature on Electron's Chromium runtime.
- **Loading the engine in main and IPC for everything** — adds latency to plan/balance computations for no real benefit; the renderer can run pure-JS engine code directly.
- **electron-vite (the framework)** — convenient but opinionated; the manual `concurrently` + `wait-on tcp:5173` setup is ~30 lines and stays transparent.

## Consequences

- All persistent IO (session JSON files, holiday API) stays in the main process — sandboxed renderer cannot reach the filesystem directly.
- The CLI's existing data directory (`~/.tp-scroll/sessions/`) is shared with the desktop app — you can edit the same sessions from either host.
- Adding a new IPC capability is a four-line change: extend `TpScrollApi` in `src/api/types.ts`, add the handler in `electron/ipc.ts`, expose it in `electron/preload.ts`, and call it from the renderer.
- Production packaging / auto-update / code-signing is out of scope for v1.0 — `pnpm dev` and `electron .` against built artifacts are the only supported run modes.
