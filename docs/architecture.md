# Architecture

## Overview

tp-scroll is a TypeScript monorepo. The domain core enumerates and ranks trip plans against a user's leave cycle, public holidays, and personal constraints. Adapters provide the public-holiday data and session persistence. Two hosts compose them: a `tp-scroll` CLI and an Electron desktop app.

## Layer Map

```
tp-scroll/
├── packages/core/                # pure logic — no IO, no Node-only deps
├── packages/adapters/holidays/   # HolidayProvider implementations
├── packages/adapters/storage/    # SessionStore implementations
├── packages/cli/                 # commander entry — wires adapters into core
└── packages/desktop/             # Electron app (main + preload + React/Vite renderer)
```

## Dependency Rule

```
cli      → adapters → core
desktop  → adapters → core      (main process only — Node modules)
desktop  → core                 (renderer process — pure-JS engine)
adapters → core
core     → (nothing internal)
```

- `core` imports nothing from `adapters/`, `cli/`, or `desktop/`.
- `core` does not import `node:*`, `fs`, `path`, `os`, `child_process`, `fetch`, or any IO-bearing module. Pure functions and Zod-validated data only.
- `adapters` implement interfaces defined in `core`. Adapters may use Node built-ins.
- `cli` is one composition root — the only place where adapters and core are wired together for the CLI host.
- `desktop/electron/*` (main + preload) is the second composition root. The renderer process can import `core` for the pure-JS engine (e.g. running `optimize()` synchronously on a button click) but never touches `adapters/*` directly — all IO crosses the typed IPC bridge defined in `desktop/src/api/types.ts`.

## Module Boundaries

| Module | Responsibility | Key Types |
|--------|---------------|-----------|
| `core/calendar` | DayInt arithmetic, weekend resolution, ranges, Clock | `DayInt`, `Clock` |
| `core/leave` | Cycles, buckets, balance | `LeaveCycle`, `LeaveBucket` |
| `core/session` | Session shape + lifecycle, defaults, Zod | `Session`, `HistoricalCycle` |
| `core/trips` | Trip shape, per-day attribution, cost | `Trip`, `DayAttribution` |
| `core/constraints` | Blocked periods, anchors, Schengen, booking horizon | `BlockedPeriod`, `AnchorDate`, `SchengenWatch` |
| `core/optimizer` | Branch-and-bound search + lexicographic scoring + multi-seed diversity | `TripPlan`, `optimize()` |
| `adapters/holidays` | Public-holiday data | `HolidayProvider`, `Holiday` |
| `adapters/storage` | Session persistence | `SessionStore` |
| `cli` | Command-line host | command modules |
| `desktop/electron/*` | Electron main + preload | `TpScrollApi` IPC contract |
| `desktop/src/*` | React renderer | views: Calendar, Trips, Plan, Burndown, Sessions |

## Key Data Flows

### `tp-scroll plan` (CLI)
```
cli/bin.ts
  → adapters/storage::JsonFileSessionStore.load(id)
  → adapters/holidays::FallbackHolidayProvider.forCountry(...)
  → core/optimizer.optimize(session, { holidays, clock })
  → cli/format/table prints top 5
```

### Desktop — Run optimization on the Plan view
```
desktop/src/views/Plan
  → core/optimizer.optimize(session, { holidays, clock, seedCount }) [synchronous, renderer process]
  → render TripPlan[] as score chips + trip lists
```

### Desktop — Add a trip
```
desktop/src/views/Trips/TripForm
  → state/session.addTrip(trip)
  → bridge.sessions.save(session)  [IPC → main]
  → main: adapters/storage::JsonFileSessionStore.save(session)  (atomic temp+rename)
```

## Cross-Cutting Concerns

| Concern | Approach |
|--------|----------|
| Validation | Zod at every external boundary. TS types derived via `z.infer`. |
| Logging | `Logger` interface in `core` (no-op default). CLI wires `pino`. |
| Clock | Injected via `Clock` interface. `core` never calls `Date.now()`. |
| Errors | `Result`-style at adapter boundaries; throws only on contract violations in `core`. |
| Performance | Optimizer must terminate within seconds on a one-year horizon. |
| Electron hardening | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Renderer reaches Node only through the typed `tpScrollApi` preload bridge. |
| UI styling | CSS Modules + design tokens via CSS custom properties. No utility framework. Fonts self-hosted (Fraunces + JetBrains Mono). |
