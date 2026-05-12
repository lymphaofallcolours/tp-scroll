# ADR 0002 — Branch-and-bound optimizer for v0.1

**Status:** Accepted (2026-05-12)

## Context

The optimizer enumerates non-overlapping trip plans against a leave cycle, subject to constraints, and ranks them lexicographically. The v0.1 quality bar: terminate within a few seconds on a one-year horizon and return ≥5 distinct plausible plans.

## Decision

Branch-and-bound search over candidate trip windows:
- Generate candidate trip windows (start day × length) within `[minTripDays, maxTripDays]`.
- Prune any window that overlaps a `BlockedPeriod`, violates `bookingHorizonDays`, or causes `consumed > totalDays - bufferAtEnd`.
- For Schengen: prune any partial plan whose rolling 180-day max would exceed 90.
- Score by the lexicographic comparator; keep top N by branch-and-bound bounding on the best-so-far.

## Alternatives rejected

- **CP-SAT / OR-Tools (WASM)** — overkill for v0.1, large bundle, harder onboarding. Revisit in v0.3 if branch-and-bound proves inadequate.
- **Mixed-integer programming** — same: high ceiling, high floor.
- **Hand-rolled greedy** — too easy to miss good plans on tight constraints.

## Consequences

- The optimizer is *not* provably optimal in v0.1. The property tests assert correctness (no constraint violation, consumed+remaining=totalDays, monotonicity), not optimality.
- Future v0.3 may swap the search backend behind the same `optimize()` signature.
