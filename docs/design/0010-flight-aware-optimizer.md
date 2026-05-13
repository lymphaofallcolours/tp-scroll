# ADR 0010 — Flight-aware optimizer

**Status:** Accepted (2026-05-13)

## Context

v1.5 (originally ADR 0009 with Amadeus, now ADR 0012 with Travelpayouts) wired in flight quotes as **informational** annotations on the optimizer's output. v1.7 promotes flight data to **decisional** — flight prices and time-of-day constraints now shape which plans appear in top-K and in what order. Per the original prompt: optional price-as-objective, max flight duration constraint, and time-of-day (depart-after / arrive-before) with AND/OR composition.

The original v1.5 ADR (Amadeus) was superseded on 2026-05-13 when Amadeus announced its Self-Service portal EOL for 2026-07-17. The interface described in this ADR is provider-agnostic and survived the pivot unchanged — only the concrete adapter class swapped.

## Decision

Three additions, all backwards-compatible:

### 1. `FlightConstraints` in `core/constraints/flight.ts`

Pure-data Zod schema:

```ts
type FlightConstraints = {
  maxDurationMinutes?: number;
  departAfterHour?: number;   // 0-23, local time at origin
  arriveBeforeHour?: number;  // 0-23, local time at destination
  combineMode?: "and" | "or"; // default "and"
};
```

`passesFlightConstraints(info: CandidateFlightInfo, c: FlightConstraints): boolean` is pure. AND requires every set constraint to pass; OR requires at least one. Each set constraint applies to **both legs** (outbound + inbound) — asymmetric checks would let cheap-but-bad return flights through.

Missing leg data is conservatively treated as PASS. A constraint can only DISQUALIFY a candidate when the upstream gave us enough data to fail it. This matches the v1.5 stance of not punishing the user for the upstream's gaps.

`Session.flightConstraints?: FlightConstraints` is optional and persisted alongside the rest of the session shape.

### 2. `LegInfo` in core (not in the adapter)

```ts
type LegInfo = {
  priceMinor: number;
  currency: string;
  durationMinutes: number;
  departHour: number;
  arriveHour: number;
};
```

The adapter (`@tp-scroll/adapter-flights`) **re-exports** the core type so application code can keep its existing imports. `legInfoOf(quote: FlightQuote): LegInfo | undefined` lives in the adapter (it depends on the adapter's `FlightQuote` shape) and returns `undefined` when any required field is missing.

### 3. Optimizer additions

```ts
type OptimizeOptions = {
  // ...existing...
  flightInfo?: (candidateTripId: string) => CandidateFlightInfo | undefined;
  priceAware?: boolean;
};
```

- `flightInfo` is a **sync** lookup: the caller pre-fetches and indexes. The optimizer stays pure-JS / synchronous — no async fan-out in the search hot path.
- `optimize()` filters candidates via `passesFlightConstraints` when both `session.flightConstraints` and `flightInfo` are present.
- When `priceAware: true`, plans carry `priceTotalMinor` (sum of outbound + inbound across the plan's candidates) and the lexicographic score grows a 5th tier on **negated** price (lower price wins under "higher tuple value first").

### 4. Score-tuple width is a discriminated union

`PlanScore` is now `readonly [a,b,c,d] | readonly [a,b,c,d,e]`. The comparator iterates `Math.min(a.length, b.length)` so a 4-tuple from a `priceAware:false` caller can still be compared to a 5-tuple from a `priceAware:true` caller — they tie on price (the comparator never sees it). Old callers that ignored price keep working unchanged.

## Why sync flight lookup, not async

The optimizer is a hot synchronous loop; making it async would cascade through the whole compareScores chain. Pre-fetching outside the optimizer keeps the search tight and lets the caller decide HOW to source the data:

- Desktop demo: fetch for all candidates upfront (mock provider is instant; Travelpayouts would be slow and would chew through the rate limit).
- A future CLI command: stream + cache per route.
- A test: feed a deterministic in-memory map.

## Why both legs share each constraint

Common alternative: "depart after 18" applies only to the outbound leg (the trip to home). Rejected because it lets bad return flights through — nobody wants a 6 am Monday return any more than a 6 am Friday departure. Users who want asymmetric rules can encode them via the `or` combine mode plus separate constraints, or wait for a session-level departure-asymmetric option in a future version.

## Desktop UI

- **Sessions view**: new "Flight constraints" card with four inputs (max duration, AND/OR combine, depart after, arrive before) plus Apply/Clear. Persists to `session.flightConstraints` via the new `setFlightConstraints` store action.
- **Plan view**: new "price-aware" checkbox in the control bar (gated on "flights" being enabled — without prices, there's nothing to rank by). When on, the displayed top-K is re-ordered post-hoc: filtered by `passesFlightConstraints` against the per-trip annotations, then sorted by `compareScores` with price as the tiebreaker.

The renderer applies the constraint check as a **post-process** over the top-K (not by pre-fetching flight info for every candidate before optimize runs). For a one-year session with 800 capped candidates × 2 legs = 1600 quotes per run, pre-fetching is fine with the mock provider but would chew through Travelpayouts's 60-rpm rate limit. The post-process approach delivers the user-visible behavior without the bandwidth cost. Engine callers (CLI scripts, future host) can still take the full pre-fetch path via the optimizer's `flightInfo` + `priceAware` options.

## Alternatives considered

- **Price as an additive weight, not a lex tier.** Rejected: weighted-sum was already considered for the original lexicographic decision (ADR 0002) and the same arguments apply. Lex is predictable; users understand "cheaper wins among ties on the existing four tiers" intuitively.
- **Async `flightInfo` callback in the optimizer.** Rejected: would force the search to be async, propagating through every score comparison. The pre-fetch pattern is well-suited to the workload.
- **Per-leg asymmetric constraints.** Rejected for v1.7 as overkill; the OR-combine plus separate constraints covers most practical cases.

## Consequences

- The engine path is complete: a CLI or alternate host can run `optimize(session, { flightInfo, priceAware: true })` and get fully flight-aware results, including constraint filtering and price tiebreaking.
- The desktop demo's post-process flow is a known approximation. v1.8 could introduce a "bounded pre-fetch" mode for users who want full constraint enforcement at the cost of more API calls.
- The 5-tier scoring opens room for a future v1.7.x to add a 6th tier (carrier preference?) without re-thinking the tuple shape.
