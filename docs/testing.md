# Testing

Test-driven throughout. Red → Green → Refactor, ≤5 min per cycle.

## Pyramid

| Layer | Where | Tooling |
|------|-------|--------|
| Unit | `packages/core/tests/{calendar, leave, trips, constraints}/` | vitest |
| Property | `packages/core/tests/optimizer/properties/` | vitest + fast-check |
| Adapter contract | `packages/adapters/*/tests/contract.test.ts` | vitest (parameterized over implementations) |
| Adapter integration | `packages/adapters/*/tests/{nager,json-file,fallback}.test.ts` | vitest, fetch mocked, mkdtemp for files |
| End-to-end smoke | `packages/cli/tests/cli.smoke.test.ts` | vitest, in-process `main(argv, deps)` |

## Optimizer invariants

Seven fast-check properties live in `packages/core/tests/optimizer/properties/invariants.test.ts` and run with `numRuns: 25` (20 for the more expensive one) for CI speed:

1. `consumed + remaining = total` for every returned plan
2. No plan exceeds the leave budget (`cycle.totalDays − bufferAtEnd`)
3. No plan's trips overlap a `BlockedPeriod`
4. Trips inside a plan are pairwise non-overlapping
5. Rank-1 plan has ≥ rank-2 plan's `awayDays`
6. Adding a `BlockedPeriod` never produces a plan covering it
7. Ranking is consistent with the lexicographic comparator

## Conventions

- **TDD is mandatory.** Failing test first; minimum code to pass; refactor.
- **AAA structure.** Arrange / Act / Assert; one action per test.
- **Mock only at architectural boundaries** — `fetch` in `nager.test.ts`, never the unit under test.
- **Fixtures over inline literals.** `packages/core/tests/fixtures/sessions.ts` provides `makeSession()` and `makeTrip()` builders. Tests override only what they care about.
- **Time is injected.** Anything that depends on "today" takes a `Clock`; tests use `FixedClock(day)`.
- **Tmp dirs for file I/O.** `packages/adapters/storage/tests/tmp-home.ts` wraps `mkdtemp` + cleanup.

## Running

```bash
pnpm -r test                          # everything
pnpm --filter @tp-scroll/core test    # unit + properties (≈ 90s)
pnpm --filter @tp-scroll/cli test     # smoke
```
