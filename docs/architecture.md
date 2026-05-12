# Architecture

## Overview

tp-scroll is a TypeScript monorepo. The domain core enumerates and ranks trip plans against a user's leave cycle, public holidays, and personal constraints. Adapters provide the public-holiday data and session persistence. A CLI wires everything together for v0.1.

## Layer Map

```
tp-scroll/
├── packages/core/                # pure logic — no IO, no Node-only deps
├── packages/adapters/holidays/   # HolidayProvider implementations
├── packages/adapters/storage/    # SessionStore implementations
└── packages/cli/                 # commander entry — wires adapters into core
```

## Dependency Rule

```
cli → adapters → core
cli → core
adapters → core
core → (nothing internal)
```

- `core` imports nothing from `adapters/` or `cli/`.
- `core` does not import `node:*`, `fs`, `path`, `os`, `child_process`, `fetch`, or any IO-bearing module. Pure functions and Zod-validated data only.
- `adapters` implement interfaces defined in `core`. Adapters may use Node built-ins.
- `cli` is the composition root — the only place where adapters and core are wired together.

## Module Boundaries

| Module | Responsibility | Key Types |
|--------|---------------|-----------|
| `core/calendar` | DayInt arithmetic, weekend resolution, ranges, Clock | `DayInt`, `Clock` |
| `core/leave` | Cycles, buckets, balance | `LeaveCycle`, `LeaveBucket` |
| `core/session` | Session shape, defaults, Zod | `Session` |
| `core/trips` | Trip shape, per-day attribution, cost | `Trip`, `DayAttribution` |
| `core/constraints` | Blocked periods, anchors, Schengen, booking horizon | `BlockedPeriod`, `AnchorDate`, `SchengenWatch` |
| `core/optimizer` | Branch-and-bound search + lexicographic scoring | `TripPlan`, `optimize()` |
| `adapters/holidays` | Public-holiday data | `HolidayProvider`, `Holiday` |
| `adapters/storage` | Session persistence | `SessionStore` |
| `cli` | User-facing entry point | command modules |

## Key Data Flows

### `tp-scroll plan`
```
cli/bin.ts
  → adapters/storage::JsonFileSessionStore.load(id)
  → adapters/holidays::FallbackHolidayProvider.forCountry(...)
  → core/optimizer.optimize(session, { holidays, clock })
  → cli/format/table prints top 5
```

### `tp-scroll trips add`
```
cli/bin.ts
  → parses CLI dates → Temporal.PlainDate → DayInt
  → core/trips constructs Trip
  → core/trips/cost computes leaveCost via attribution rules
  → adapters/storage::JsonFileSessionStore.save(session)  (atomic write)
```

## Cross-Cutting Concerns

| Concern | Approach |
|--------|----------|
| Validation | Zod at every external boundary. TS types derived via `z.infer`. |
| Logging | `Logger` interface in `core` (no-op default). CLI wires `pino`. |
| Clock | Injected via `Clock` interface. `core` never calls `Date.now()`. |
| Errors | `Result`-style at adapter boundaries; throws only on contract violations in `core`. |
| Performance | Optimizer must terminate within seconds on a one-year horizon. |
