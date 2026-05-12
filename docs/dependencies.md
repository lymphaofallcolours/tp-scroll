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
| `tsup` | Bundle the CLI to a single executable. |
| `eslint`, `@typescript-eslint/*`, `prettier`, `eslint-config-prettier` | Lint + format. |
| `@js-temporal/polyfill` | Opt-in for Node 20 contributors. Production path uses native `Temporal` on Node ≥22. |

## Runtime requirement

Node ≥22 is required for the native `Temporal` API. On Node 20 you can opt in to the polyfill by setting `TP_SCROLL_POLYFILL_TEMPORAL=1` before running the CLI; see the `core/calendar` README for details.
