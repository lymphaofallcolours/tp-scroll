# ADR 0012 — Flight provider pivot to Travelpayouts

**Status:** Accepted (2026-05-13)

Supersedes [0009-flights-amadeus](./0009-flights-amadeus.md).

## Context

In late February 2026, Amadeus announced the decommissioning of its Self-Service API portal. New developer registrations were paused in March 2026; existing API keys go dark on **2026-07-17**. The Enterprise portal continues but is contract-based and unsuitable for an open-source single-user tool. tp-scroll therefore needs a replacement flight-pricing provider before mid-July.

## Decision

Adopt **Travelpayouts (Aviasales Data API)** as the sole real flight provider, and remove the Amadeus adapter outright. The `MockFlightProvider` continues to serve as the no-credentials fallback.

The interface (`packages/adapters/flights/src/provider.ts`) is unchanged — `FlightProvider.cheapestDirect(args)` returning a `FlightQuote | null`. Migrating providers required no engine, optimizer, or UI shape changes beyond the credentials form on the Sessions tab.

### Endpoint and shape

- `GET https://api.travelpayouts.com/aviasales/v3/prices_for_dates`
- Per-direction query — `one_way=true&direct=true&sorting=price&limit=1`
- Currency must be explicit (the API otherwise returns RUB) — we default to `EUR`.
- Authentication is a single static token sent as `X-Access-Token`. No OAuth, no refresh.

### Response transformation

| FlightQuote field | Travelpayouts source |
|---|---|
| `priceMinor` | `Math.round(price * 100)` (price is in major units) |
| `currency` | top-level `currency`, falling back to requested |
| `carrier` | `airline` (IATA) |
| `stops` | `transfers` (always 0 with `direct=true`) |
| `durationMinutes` | `duration_to` (v3 returns minutes directly) |
| `departHour` | UTC hour parsed from `departure_at` |
| `arriveHour` | `(departHour + durationMinutes) mod 24` |

### Credentials and storage

- Env var: `TP_SCROLL_TRAVELPAYOUTS_TOKEN` (single value, replaces `TP_SCROLL_AMADEUS_CLIENT_ID` / `_CLIENT_SECRET`).
- Optional env var: `TP_SCROLL_TRAVELPAYOUTS_CURRENCY` (defaults to `EUR`).
- On-disk file: `~/.tp-scroll/flights.json` with shape `{ "token": string, "currency"?: string }`, mode 0600.
- Env value takes precedence over the file (matches the Amadeus pattern).
- Legacy `{ clientId, clientSecret }` shape on disk is detected at load time and logged once as a warning; the file is treated as "no credentials" until the user provides a new token via the Settings card. No auto-migration — there is no algorithmic path from a client_id pair to a Travelpayouts token.

## Consequences

**Positive**
- Free tier is sufficient for tp-scroll's volume (combinatorial scans cap at ~100 calls per optimizer run; rate limit is 60 rpm before contact).
- Single-token auth simplifies the credentials UI (one input, one show/hide toggle) and the storage shape.
- Travelpayouts data is a 48-hour cached snapshot of real user searches — well-matched to a planning tool that asks "what's the cheapest time to fly" rather than "book me this flight now".
- The local `CachingFlightProvider` LRU keeps doing its job (bandwidth reduction); the upstream cache is a bonus.

**Negative**
- Prices are not live. Surfaced in the UI as "indicative — Travelpayouts caches the cheapest tickets actually searched by other users in the last 48 hours". Acceptable for planning, not for booking.
- `departure_at` is UTC. With Amadeus it was local-at-origin. The flight-constraint depart-after / arrive-before filters therefore now operate on UTC hours. For travellers in time zones close to UTC the practical impact is small; users who care can adjust their threshold. See follow-up below.
- The `bookingUrl` field on `FlightQuote` is not populated — Travelpayouts returns affiliate deep-links that require correct cookie marking, which we skip in v1.
- Zero-decimal currencies (JPY, KRW, …) are treated as cents-of-major in the v1 transformation. Edge case for our user base; documented here rather than special-cased.

## Future option — Duffel

[Duffel](https://duffel.com) provides live, booking-grade pricing via NDC. We considered it as the replacement and instead reserve it as a future adapter slot:

- Live (no cache); cost-per-query and ~20s latency per offer-request make it unsuitable for the optimizer's combinatorial scans (50+ candidates × 2 directions = 100+ calls per run).
- Sandbox is free but live access requires commercial onboarding.
- Same `FlightProvider` interface; would drop in alongside Travelpayouts as a second real implementation.

A natural future feature is an opt-in "verify before booking" step that calls Duffel for the user's chosen plan only — single offer-request, no combinatorial blow-up. ADR not written yet; this paragraph is the placeholder.

## Follow-ups

- **Airport→timezone map.** If a user reports the UTC-hour filter as confusing in practice, ship a static lookup table mapping each airport IATA in `DEFAULT_AIRPORTS` to an IANA zone, and convert `departure_at` to local-at-origin before extracting the hour.
- **Per-session currency.** Currently a single default (`EUR`) overridable via env var or by editing `flights.json`. If a user routinely plans in GBP/USD, expose a select in the Sessions credentials card.
- **Duffel adapter.** As above.

## Verification

- `pnpm -F @tp-scroll/adapter-flights test` — all tests pass; new `travelpayouts.test.ts` covers URL formation, header auth, response transformation, currency, empty-response, schema-failure, 404, 5xx.
- `pnpm -r typecheck` clean.
- `grep -rIn "amadeus\|Amadeus\|AMADEUS" packages/ docs/ memory_docs/` returns only the SUPERSEDED reference in ADR 0009 and this ADR's own context section.
- Manual dev-app smoke: no token → mock provider; `flights.json` with `{ token: "…" }` → "travelpayouts" provider name; legacy `{ clientId, clientSecret }` → warning logged, UI reports "none".
