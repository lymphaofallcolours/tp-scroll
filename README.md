# tp-scroll

Optimize annual leave around weekends and public holidays — maximize time at home when living abroad.

A TypeScript monorepo with a pure domain core, pluggable adapters for public-holiday providers and session storage, a CLI for scripting, and an Electron desktop app for everyday use.

## Status

**v1.0** — Electron desktop app + CLI + engine. Five workspace packages:

- `@tp-scroll/core` — pure engine (calendar, leave cycles, trips, constraints, optimizer)
- `@tp-scroll/adapter-holidays` — public-holiday providers (Nager + date-holidays fallback)
- `@tp-scroll/adapter-storage` — atomic JSON-file session storage
- `@tp-scroll/cli` — `tp-scroll` command-line tool
- `@tp-scroll/desktop` — Electron app with calendar grid, trip CRUD, plan view, and burndown chart

200+ tests across the workspace including 7 fast-check optimizer invariants. Editorial-typographic UI built with Fraunces + JetBrains Mono on a warm-paper palette.

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

Set `TP_SCROLL_NETWORK=off` and the holiday provider falls back to the bundled `date-holidays` package.

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
