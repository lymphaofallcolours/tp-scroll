# ADR 0004 — Per-day trip attribution

**Status:** Accepted (2026-05-12)

## Context

The original prompt modeled travel-day handling with a single enum: `travelDayAttribution: "residence" | "home" | "half" | "configurable"`. In practice a user wants finer control: "the Friday I fly out doesn't count as a leave day (I worked the morning), but the Monday I fly back does." The two questions — "am I traveling?" and "does this consume leave?" — are independent and should both be answerable per day.

## Decision

Each `Trip` carries a sparse `dayOverrides: DayAttribution[]` array. The default rule (computed from session config + the day's calendar role: weekday / weekend / public holiday) applies to any day not present in the array.

```ts
type DayAttribution = {
  day: DayInt;
  consumesLeave?: boolean;
  isTravelDay?: boolean;
  location?: "residence" | "home" | "transit";
};
```

Two parallel tallies are computed per trip:
- `leaveCost` — number of days where the resolved attribution says `consumesLeave === true`. Drives the balance.
- `awayDays` — number of days where `location !== "residence"`. Drives home-day scoring in the optimizer.
- `travelDayList` — informational; not used by scoring.

## Alternatives rejected

- The original enum: insufficient expressiveness; users would have to fake-shift trip dates to get the right leave cost.
- A single boolean per day: forces "travel day" and "consumes leave" to be the same question, which they aren't.
- Sub-day half-day handling: explicitly deferred to v0.2 per the prompt.

## Consequences

- The data model is slightly richer, but invariant: a Trip with empty `dayOverrides` behaves exactly like the prompt's original model.
- The optimizer scores `awayDays`, not "trip length", so travel days that don't consume leave still count as time at home (correct).
- Migration from older sessions: add `dayOverrides: []` during load if missing.
