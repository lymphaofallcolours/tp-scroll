# tp-scroll — Claude Code Plan Mode prompt

You are planning **tp-scroll**, a TypeScript application that helps a user living abroad maximize time at home by optimally scheduling annual-leave trips around weekends, public holidays, and personal constraints.

## Project context

The user is a PhD student abroad with a fixed allocation of annual leave days that do not count weekends or public holidays. They want a flexible planner that:

1. Tracks consumed and remaining leave across one or more named sessions
2. Knows the public holidays of their residence country and the location of weekends
3. Records days spent inside and outside the residence country
4. Searches the calendar for trip windows that maximize a user-defined objective subject to a rich set of constraints
5. (Later) integrates flight search to annotate or influence those windows

The first deliverable is the **core engine and a thin CLI smoke test (v0.1)**. The full v1.0 target is an Electron desktop application. Flight integration, advanced reporting, and multi-device sync are explicit later phases (see roadmap appendix).

## Goals for this planning session (v0.1 scope)

Plan and scaffold the v0.1 milestone only:

- A monorepo with `core/`, `adapters/`, and a stub `cli/`
- Pure TypeScript domain model for calendars, leave cycles, sessions, trips, and constraints
- Provider-agnostic public-holiday adapter with two implementations: `nager` (online, https://date.nager.at, free, no key) as primary and `date-holidays` (npm, offline) as fallback. Fallback is selected automatically if the network call fails.
- A first-pass optimizer that, given a leave cycle and a set of constraints, enumerates feasible trip plans and ranks them by the user's objective hierarchy
- JSON-file persistence for sessions
- A minimal CLI (`tp-scroll plan`, `tp-scroll status`, `tp-scroll trips add/list`) sufficient to validate the engine end-to-end
- Test scaffolding (vitest for unit tests, fast-check for property-based tests on the optimizer)

**Do not** plan or implement in v0.1: Electron UI, flight adapters, PDF/Markdown reports, scenario diffs, multi-user, sync, mobile, notifications. These are explicit later phases.

## Tech stack (fixed decisions)

- **Language:** TypeScript, strict mode, ESM only
- **Runtime:** Node.js >= 22 (so Temporal is available natively; polyfill `@js-temporal/polyfill` if a contributor is on 20)
- **Package manager:** pnpm with workspaces
- **Date library:** Temporal API (NOT `Date`, NOT moment, NOT date-fns). Internal representation uses `Temporal.PlainDate` and integer day offsets from a fixed epoch (2000-01-01 UTC) for arithmetic-heavy code paths.
- **Validation:** Zod for all external boundaries (file IO, future API responses, CLI args)
- **Testing:** vitest + fast-check (property-based testing for the optimizer)
- **Linting/formatting:** ESLint + Prettier with sensible TypeScript defaults
- **Build:** tsup for the CLI; tsc for the libraries
- **Logging:** pino, but gated behind a `Logger` interface in core so it can be swapped per host (CLI vs future Electron)

## Repository structure

```
tp-scroll/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── packages/
│   ├── core/              # pure logic, zero IO, no Node-only imports
│   │   ├── src/
│   │   │   ├── calendar/      # day math, cycle types, weekend resolution
│   │   │   ├── leave/         # cycles, buckets, balance computation
│   │   │   ├── session/       # session shape, Zod schemas
│   │   │   ├── trips/         # trip model, day-attribution rules
│   │   │   ├── constraints/   # blocked periods, anchors, schengen
│   │   │   ├── optimizer/     # search, scoring, objective
│   │   │   └── index.ts
│   │   └── tests/
│   ├── adapters/
│   │   ├── holidays/      # HolidayProvider interface + nager + date-holidays
│   │   ├── storage/       # SessionStore interface + JSON file impl
│   │   └── (flights/)     # placeholder dir, empty in v0.1
│   └── cli/
│       └── src/           # commander-based CLI
└── docs/
    └── design/            # one ADR per major decision
```

The `core` package must have zero dependencies on Node built-ins, the filesystem, or the network. All IO crosses through `adapters`.

## Domain model (sketch — refine during planning)

```ts
// Day-precision. No times in the core. Time zones handled at edges only.
type DayInt = number; // days since 2000-01-01 UTC

interface LeaveCycle {
  id: string;
  name: string;                 // "2026 contract year"
  kind: "calendar" | "fiscal" | "anniversary";
  start: DayInt;                // inclusive
  end: DayInt;                  // inclusive
  resetDayOfYear?: number;      // for fiscal/anniversary
  totalDays: number;
  carryover: { mode: "lose" | "cumulative"; maxDays?: number };
  bufferAtEnd: number;          // days reserved
  bookingHorizonDays?: number;
  halfDaysAllowed: boolean;
  countWeekends: boolean;       // whether weekends in a trip consume leave
  travelDayAttribution: "residence" | "home" | "half" | "configurable";
}

interface LeaveBucket {
  id: string;
  name: string;                 // default "annual"
  cycleId: string;
  totalDays: number;
}

interface Trip {
  id: string;
  departure: DayInt;            // last day in residence (or first away — configurable)
  return: DayInt;
  bucketId: string;
  isActual: boolean;            // true = recorded; false = planned
  notes?: string;
}

interface BlockedPeriod {
  start: DayInt;
  end: DayInt;
  reason: string;               // "thesis defense", "teaching", "conference"
}

interface AnchorDate {
  day: DayInt;
  preferIn: "home" | "residence";
  weight: number;               // optional soft preference
}

interface SchengenWatch {
  enabled: boolean;
  windowDays: 180;
  maxDaysInWindow: 90;
}

interface Session {
  id: string;
  name: string;
  residenceCountry: string;     // ISO-3166-1 alpha-2
  homeCountry: string;
  cycle: LeaveCycle;
  buckets: LeaveBucket[];
  trips: Trip[];
  blocked: BlockedPeriod[];
  anchors: AnchorDate[];
  schengen?: SchengenWatch;
  extraHolidays: { day: DayInt; name: string }[];
  overriddenHolidays: { day: DayInt; remove: boolean }[];
  createdAt: string;
  updatedAt: string;
}
```

All shapes get a Zod schema beside them; the TS type is derived via `z.infer`.

## Optimizer specification

The optimizer's job: given a session and an optional search window (default = full current cycle), produce a ranked list of **trip plans** (each a set of non-overlapping trips) maximizing the user's objective subject to constraints.

**Hard constraints (must satisfy all):**
- Total leave days consumed across the plan ≤ (totalDays − bufferAtEnd), accounting for already-recorded trips
- No trip overlaps a `BlockedPeriod`
- Each trip's leave-day cost respects `countWeekends` and current public holidays
- Each trip duration ∈ [`minTripDays`, `maxTripDays`] (session-level config)
- If `SchengenWatch.enabled`, no 180-day rolling window exceeds 90 days outside Schengen
- If `bookingHorizonDays` set, no planned trip starts within that horizon from "today"

**Objective (lexicographic ranking, top to bottom):**
1. Maximize total days at home
2. Minimize leave-day cost per home-day (leverage ratio)
3. Maximize coverage of anchor dates weighted by anchor weight
4. Maximize number of distinct trips

**Algorithm (v0.1):** branch-and-bound over candidate departure days. Optimization not required to be provably optimal in v0.1, but must terminate within a few seconds on a one-year horizon and return ≥ 5 distinct plausible plans. Document the heuristic clearly. Note in an ADR that a future v0.3.x may swap for a constraint-programming solver if branch-and-bound proves inadequate.

**Property tests to write:**
- For any session and any plan it returns: `consumed + remaining = totalDays`
- No returned plan violates any hard constraint
- A plan with strictly more home-days than another never ranks below it (given identical leave cost)
- Adding a `BlockedPeriod` never produces a plan that covers it

## Holiday adapter contract

```ts
interface HolidayProvider {
  name: string;
  forCountry(countryCode: string, year: number): Promise<Holiday[]>;
}
interface Holiday { day: DayInt; name: string; type: "public" | "regional"; region?: string }
```

`NagerHolidayProvider` hits `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`. `DateHolidaysProvider` wraps the npm `date-holidays` package. The composite `FallbackHolidayProvider` tries the first, falls back to the second on any error, and caches per `(country, year)` in memory for the process lifetime.

The session applies `extraHolidays` and `overriddenHolidays` on top before passing to the optimizer.

## Storage adapter contract

```ts
interface SessionStore {
  list(): Promise<SessionSummary[]>;
  load(id: string): Promise<Session>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
}
```

`JsonFileSessionStore` stores one file per session under `~/.tp-scroll/sessions/{id}.json`. Atomic writes (write-temp-then-rename). Validates with Zod on load; refuses to load corrupted files with a clear error.

## CLI surface (v0.1)

Just enough to validate the engine. Use `commander`.

```
tp-scroll session new --name "2026 PhD year" --residence DE --home ES
tp-scroll session list
tp-scroll session use <id>

tp-scroll cycle set --kind calendar --total-days 25 --carryover lose
tp-scroll trips add --from 2026-04-10 --to 2026-04-18
tp-scroll trips list

tp-scroll blocked add --from 2026-09-01 --to 2026-09-30 --reason "teaching"
tp-scroll anchors add --day 2026-12-24 --prefer home --weight 10

tp-scroll status                # consumed, remaining, schengen if enabled
tp-scroll plan                  # runs optimizer, prints top 5 plans as tables
```

## Quality bar for v0.1

- TypeScript strict mode passes with zero `any`
- ESLint clean
- ≥ 80% line coverage on `core/`
- At least 6 property-based test invariants on the optimizer
- Each adapter has an interface-level test that any future implementation can run against
- One ADR per architectural decision (Temporal vs date-fns, branch-and-bound vs solver, JSON vs SQLite for storage)

## Roadmap appendix (out of scope for this plan, retain as context)

- **v0.2** — refined session lifecycle, half-days, multiple buckets, Schengen surveillance polish
- **v0.3** — optimizer refinements; consider OR-Tools-via-WASM or a minizinc backend behind the existing optimizer interface
- **v1.0** — Electron UI: calendar grid, trip entry forms, leave-balance burndown chart, Chart.js. Charts and plots welcome throughout.
- **v1.5** — `adapters/flights/`: pluggable `FlightProvider` interface. First implementation: Amadeus Self-Service (free tier, registered). Cache layer with configurable TTL. Annotates optimizer windows with cheapest direct option; does not yet influence ranking.
- **v1.7** — flight-aware optimizer: optional price-as-objective component, max flight duration constraint, time-of-day constraints (depart after X, arrive before Y, AND/OR).
- **v2.0** — PDF/Markdown reports, scenario diff, baggage filtering in flight adapter
- **v2.5** — expanded leave-type buckets (sick, parental, conference travel)
- **v3.0** — cloud sync (Supabase or self-hosted) and multi-user
- **v3.5** — React Native mobile sharing `core/`

## Skyscanner note

The user mentioned Skyscanner. Skyscanner does not expose a public API; their Travel APIs are partner-only. The chosen v1.5 provider is **Amadeus Self-Service** (free dev tier, no partner approval needed). Document this in `docs/design/flights.md` when v1.5 is planned. Alternatives to evaluate then: Duffel, Travelpayouts.

## What I want from Plan Mode

1. A concrete file-by-file plan for v0.1
2. Identification of any decisions in this prompt that need refinement before coding starts
3. A test-first ordering: which tests to write before which modules
4. An estimate of the first few PRs/commits that would carry v0.1 to "engine works end-to-end via CLI"

Do not start implementing until the plan is reviewed.
