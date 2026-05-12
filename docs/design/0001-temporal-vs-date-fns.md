# ADR 0001 — Temporal over Date / date-fns / moment

**Status:** Accepted (2026-05-12)

## Context

tp-scroll is a calendar-arithmetic application. Bugs in date handling translate directly into bugs in the leave balance, which is the user-facing value the application exists to compute. The TC39 Temporal API has reached Stage 4 and is shipping natively in Node 22.

## Decision

- All date types in `core/` are either `Temporal.PlainDate` (at boundaries) or `DayInt = number` (integer days since 2000-01-01 UTC, used everywhere inside `core`).
- `Date`, `moment`, `date-fns`, and other legacy date types are forbidden in `core/`. The ESLint config flags `new Date(` inside `packages/core/`.
- Target runtime is Node ≥22 with native `Temporal`. Node 20 contributors can opt in to the `@js-temporal/polyfill` via the `TP_SCROLL_POLYFILL_TEMPORAL=1` env var (documented in `docs/dependencies.md`).

## Alternatives rejected

- `Date` — timezone-prone, mutable, no plain-date concept.
- `moment` — deprecated by its own maintainers, large bundle.
- `date-fns` — solid but built around `Date`, inherits its problems.
- `luxon` — good, but Temporal is the standard.

## Consequences

- All date arithmetic in `core/` is integer arithmetic on `DayInt`. Fast, deterministic, no timezone bugs.
- Conversion to/from strings happens only at adapter boundaries.
- Node 22 is a hard minimum.
