# ADR 0009 — Flight provider (Amadeus Self-Service)

**Status:** SUPERSEDED by [0012-flights-travelpayouts](./0012-flights-travelpayouts.md) (2026-05-13 — Amadeus Self-Service portal decommissioning announced for 2026-07-17). Kept as historical record; do not implement against this design.

Original status: Accepted (2026-05-13)

## Context

v1.5 annotates the optimizer's trip plans with flight prices. The original prompt called out Skyscanner; this ADR records why we ship Amadeus Self-Service instead and what shape the rest of the integration takes.

## Decision

A new `@tp-scroll/adapter-flights` workspace package with a small surface:

```ts
type FlightProvider = {
  readonly name: string;
  cheapestDirect(args: {
    origin: string;       // ISO-3166-1 alpha-2 or IATA
    destination: string;
    date: DayInt;
  }): Promise<FlightQuote | null>;
};
```

Three implementations:

- **`MockFlightProvider`** — deterministic-by-hash quotes, always returns a result. Used in tests, in the renderer's stub bridge (so `pnpm vite preview` paints prices), and as the production fallback when the main process can't construct a real provider.
- **`AmadeusFlightProvider`** — the real upstream. OAuth2 client-credentials against `test.api.amadeus.com`; queries `/v2/shopping/flight-offers` with `nonStop=true&max=5`; picks the cheapest by `parseFloat(price.total)`. Maps ISO-3166-1 alpha-2 country codes to IATA via a small `DEFAULT_AIRPORTS` lookup.
- **`CachingFlightProvider`** — wraps any FlightProvider with an in-memory LRU (default 500) + TTL (default 24h). Caches null responses too. The main process always wraps whatever real provider it constructs with this.

A separate `annotatePlan({plan, provider, origin, destination})` function fans out per-trip outbound + return queries with a configurable concurrency cap (default 4) and returns an `AnnotatedTripPlan` carrying per-trip `{outbound, inbound}` quotes plus an aggregate total.

## Why Amadeus, not Skyscanner

Skyscanner does not expose a public API; their Travel APIs are partner-only and require a vetted commercial agreement. Amadeus Self-Service offers a free developer tier (~2k queries/month against the test environment, switchable to production with the same credentials), no partner approval, and well-documented OAuth + REST endpoints.

## Alternatives considered

- **Duffel** — modern API, well-priced, but requires a commercial relationship and a verified business entity. Worth revisiting for v1.7+ when ranking starts to depend on flight data.
- **Travelpayouts** — affiliate-network aggregator; works without commercial vetting but the data quality and freshness vary by partner. Re-evaluate alongside Duffel.
- **Hand-rolled scraper** — ToS-violating and brittle.

## OAuth + rate-limit posture

- Token cached in-process for `expires_in − 30s`. Single token serves all queries during its lifetime.
- 24-hour cache TTL on `(origin, destination, date)` means a typical session (5 trips × 2 legs = 10 quotes per plan × 5 plans = 50 quotes) costs ~50 API calls on first run, then zero for the next 24h.
- `nonStop=true` is hardcoded for v1.5. Multi-stop / longer-haul scenarios will be a session-level option in v1.7.
- `currencyCode=EUR` is the default. Override with the `currency` constructor option.

## Credentials

The provider is constructed from env vars:

```bash
TP_SCROLL_AMADEUS_CLIENT_ID=...
TP_SCROLL_AMADEUS_CLIENT_SECRET=...
```

When either is missing, `amadeusFromEnv()` returns `null` and the CLI / desktop main process falls back to `MockFlightProvider`. The UI shows a `(mock)` badge so it's obvious you're not looking at real prices.

When `TP_SCROLL_NETWORK=off` is set, the main process always uses `MockFlightProvider` even if Amadeus creds are configured — matches the offline-mode posture of the holiday provider.

## Consequences

- The optimizer is unchanged in v1.5 — flight data is **informational**. The lexicographic ranking still goes home days → leverage → anchors → trips. v1.7 will introduce a price-as-objective component.
- IATA mapping is hardcoded for 28 common countries. v2.0 will let sessions override per residence/home.
- The Plan view's "flights" toggle is **opt-in** (default off) so the demo's first-run experience doesn't burn API quota or wait on network.
- Mocked quotes are explicitly labeled in the UI to prevent the user from mistaking them for real prices.
