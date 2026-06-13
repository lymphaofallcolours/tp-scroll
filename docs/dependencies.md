# Dependencies

Curated list of runtime and dev dependencies and why each one is here.

## Runtime

| Package | Purpose |
|--------|---------|
| `zod` | Runtime validation at every external boundary. TS types are derived from schemas via `z.infer`. |
| `commander` | CLI argument parsing. |
| `pino` | Structured logging in the CLI host (wired behind `core/logger.ts::Logger`). |
| `date-holidays` | Offline public-holiday source; used by the fallback provider when Nager is unreachable. |

## Dev

| Package | Purpose |
|--------|---------|
| `typescript` | The language. Strict mode, ESM, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. |
| `vitest` | Unit + integration tests. |
| `fast-check` | Property tests for the optimizer (≥6 invariants). |
| `tsup` | Bundle the CLI to a single executable; also bundles the desktop main process (with all runtime deps inlined) for self-contained packaging. |
| `electron-builder` | Package the desktop app into a Linux AppImage + `.deb` and publish them to GitHub Releases. Desktop package only. See [`desktop.md`](desktop.md). |
| `eslint`, `@typescript-eslint/*`, `prettier`, `eslint-config-prettier` | Lint + format. |
| `@js-temporal/polyfill` | Opt-in for Node 20 contributors. Production path uses native `Temporal` on Node ≥22. |

## Runtime requirement

Node ≥22 is required (ESM, workspace features). We import `Temporal` from `@js-temporal/polyfill`, so no V8 flags are needed. When Node ships `Temporal` unflagged we swap to the native global behind the single wrapper in `packages/core/src/calendar/temporal.ts`.
