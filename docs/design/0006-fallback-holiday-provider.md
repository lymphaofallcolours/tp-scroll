# ADR 0006 — Fallback holiday provider (Nager primary, date-holidays fallback)

**Status:** Accepted (2026-05-12)

## Context

The optimizer needs public-holiday data. Nager (https://date.nager.at) is free, accurate, and requires no API key — but is a network call. We also need the tool to work offline.

## Decision

Two providers behind a shared `HolidayProvider` interface, composed by a `FallbackHolidayProvider`:

- `NagerHolidayProvider` — primary. Hits `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`. Validates response with Zod. Converts ISO dates to `DayInt` at the boundary.
- `DateHolidaysProvider` — fallback. Wraps the npm `date-holidays` package. Always available, no network.
- `FallbackHolidayProvider` — tries the primary, falls back on any error from primary, caches per `(country, year)` for the process lifetime.

`TP_SCROLL_NETWORK=off` env var forces the fallback path (used by tests and offline runs).

## Alternatives rejected

- Nager only: no offline support.
- date-holidays only: less accurate data, weaker country coverage for regional variants.
- Hand-roll a static dataset: data maintenance burden.

## Consequences

- The CLI works offline.
- Cache lifetime is the process — fine for the CLI. The future Electron host may want a longer TTL.
- The contract test in `packages/adapters/holidays/tests/contract.test.ts` runs against both providers, so adding a third (e.g. a paid API) gets free coverage.
