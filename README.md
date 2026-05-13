# tp-scroll

Optimize annual leave around weekends and public holidays — maximize time at home when living abroad.

A TypeScript monorepo with a pure domain core, pluggable adapters for public-holiday providers and session storage, a CLI for scripting, and an Electron desktop app for everyday use.

## Status

**v2.5** — flight-aware optimizer + per-kind buckets (annual / sick / parental / conference / other). Six workspace packages:

- `@tp-scroll/core` — pure engine (calendar, leave cycles, trips, constraints, optimizer)
- `@tp-scroll/adapter-holidays` — public-holiday providers (Nager + date-holidays fallback)
- `@tp-scroll/adapter-storage` — atomic JSON-file session storage
- `@tp-scroll/adapter-flights` — flight-price providers (Travelpayouts + Mock, caching wrapper, annotation orchestrator)
- `@tp-scroll/cli` — `tp-scroll` command-line tool
- `@tp-scroll/desktop` — Electron app with calendar grid, trip CRUD, plan view (now with flight prices), burndown chart, sessions management

290+ tests across the workspace including 7 fast-check optimizer invariants. Editorial-typographic UI built with Fraunces + JetBrains Mono on a warm-paper palette.

See [`docs/`](docs/) for the architecture, CLI reference, and ADRs.

## Quickstart

Requires Node ≥ 22 and pnpm 10.x.

```bash
pnpm install
pnpm -r build
pnpm -r test
```

### Desktop

```bash
pnpm --filter @tp-scroll/desktop dev
```

Opens the Electron window pointed at the Vite dev server. First run loads a beautiful demo session (DE → ES, with Easter / Summer / Christmas trips on the calendar); use the Sessions tab to create your own.

### CLI

```bash
node packages/cli/dist/bin.js session new --name "2026" --residence DE --home ES
node packages/cli/dist/bin.js cycle set --kind calendar --total-days 25 --carryover lose
node packages/cli/dist/bin.js trips add --from 2026-04-10 --to 2026-04-18
node packages/cli/dist/bin.js status
node packages/cli/dist/bin.js plan --top 5 --diverse
```

Sessions live at `~/.tp-scroll/sessions/{id}.json` (atomic writes, Zod-validated on load). The active session id is tracked at `~/.tp-scroll/active.json`. The desktop app and CLI share the same data directory.

### Offline mode

Set `TP_SCROLL_NETWORK=off` and both the holiday and flight providers fall back to local sources (the bundled `date-holidays` package and the `MockFlightProvider` respectively).

### Flight prices (optional)

Register a free [Travelpayouts](https://travelpayouts.com/) account, copy the token from Profile → API tokens, then either:

```bash
export TP_SCROLL_TRAVELPAYOUTS_TOKEN=...
# optional, defaults to EUR
export TP_SCROLL_TRAVELPAYOUTS_CURRENCY=EUR
```

… or paste the token into the **Flight provider credentials** card on the Sessions tab (stored locally in `~/.tp-scroll/flights.json` with mode 0600). The Plan view's "flights" toggle then fetches indicative prices for each trip's legs (queries are cached for 24h to stay under the 60-rpm rate limit). Without a token, the toggle returns mock data with a `(mock)` badge in the UI.

Prices come from a 48-hour rolling cache of what other users have actually searched — they're useful for planning, not booking. See [`docs/design/0012-flights-travelpayouts.md`](docs/design/0012-flights-travelpayouts.md) for the integration details and the Amadeus → Travelpayouts pivot (2026-05-13).

## Development

```bash
pnpm -r typecheck                       # strict TypeScript across all packages
pnpm -r lint                            # ESLint
pnpm -r test                            # vitest (unit + property + smoke)
pnpm -r build                           # tsc / tsup / vite per package
pnpm --filter @tp-scroll/core coverage  # v8 coverage report (95%+ on core)
```

## License

MIT — see [LICENSE](LICENSE).
