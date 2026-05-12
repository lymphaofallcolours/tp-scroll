# ADR 0005 — Clock is injected, not read

**Status:** Accepted (2026-05-12)

## Context

Several constraints depend on "today" (e.g. `bookingHorizonDays`). Reading the system clock inside `core/` makes tests time-dependent and flaky.

## Decision

`core/calendar/clock.ts` defines:

```ts
export type Clock = { today(): DayInt };
export const FixedClock = (d: DayInt): Clock => ({ today: () => d });
```

Tests inject `FixedClock(someKnownDay)`. The CLI provides a `SystemClock` that wraps `Temporal.Now.plainDateISO()`. `core/` never calls `Date.now()` or `Temporal.Now.*`.

## Alternatives rejected

- Reading `Date.now()` directly: untestable, flake-prone.
- A module-level `globalClock` setter: hidden global state.
- Passing the current day as a primitive: works but loses meaning at the type level (`number` vs `Clock`).

## Consequences

- Every function that depends on "today" takes a `Clock` parameter.
- Tests are deterministic.
- A future scheduler could inject a fast-forwarding clock for what-if analysis without touching core code.
