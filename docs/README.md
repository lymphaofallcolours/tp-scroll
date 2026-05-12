# tp-scroll documentation

Project documentation, kept in sync with the codebase at every commit.

## Map

- [`architecture.md`](architecture.md) — high-level system overview and layer boundaries
- [`cli.md`](cli.md) — CLI command reference
- [`testing.md`](testing.md) — test pyramid, optimizer invariants, conventions
- [`dependencies.md`](dependencies.md) — runtime + dev dependencies and why each one is here
- [`design/`](design/) — Architecture Decision Records (ADRs)

## Status

**v1.5** — engine + CLI + Electron desktop app + flight-price annotations.

### Versions shipped on `main`

| Version | What landed |
|---|---|
| v0.1 | Engine, adapters, CLI smoke test. 156 tests, 7 fast-check optimizer invariants. |
| v0.2 | Half-days, multi-bucket budgets, Schengen status polish, cycle lifecycle (`rollCycle`). |
| v0.3 | Optimizer polish: multi-seed search for cross-cluster top-K diversity (`--diverse`). LP-relaxation bound attempted and rolled back for perf reasons (see [`design/0002-branch-and-bound-optimizer.md`](design/0002-branch-and-bound-optimizer.md)). |
| v1.0 | Electron desktop app — Calendar grid, Trip CRUD, Plan view, Burndown chart, Sessions management. Editorial-typographic UI ([`design/0008-frontend-design-tokens.md`](design/0008-frontend-design-tokens.md)). |
| v1.5 | Flight adapter ([`design/0009-flights-amadeus.md`](design/0009-flights-amadeus.md)). New `@tp-scroll/adapter-flights` package. Amadeus Self-Service + Mock providers, in-memory LRU + TTL cache, `annotatePlan` orchestrator. Plan view shows per-trip + total flight prices behind an opt-in toggle. **Informational only — v1.5 does not influence ranking yet.** |
