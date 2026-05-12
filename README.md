# tp-scroll

Optimize annual leave around weekends and public holidays — maximize time at home when living abroad.

A TypeScript monorepo with a pure domain core, pluggable adapters for public-holiday providers and session storage, and a CLI that validates the engine end-to-end.

## Status

**v0.1** — engine + CLI smoke test. 156 tests across 22 files (134 in `core`, 19 holiday adapter, 13 storage adapter, 3 CLI smoke), 7 fast-check property invariants on the optimizer, full typecheck + lint clean.

See [`docs/`](docs/) for architecture and the CLI reference, and [`docs/design/`](docs/design/) for ADRs.

## Quickstart

Requires Node ≥ 22 and pnpm 10.x.

```bash
pnpm install
pnpm -r test           # 156 tests, ≈ 90s including property suite
pnpm -r build
node packages/cli/dist/bin.js session new --name "2026" --residence DE --home ES
node packages/cli/dist/bin.js cycle set --kind calendar --total-days 25 --carryover lose
node packages/cli/dist/bin.js trips add --from 2026-04-10 --to 2026-04-18
node packages/cli/dist/bin.js status
node packages/cli/dist/bin.js plan --top 5
```

Sessions live at `~/.tp-scroll/sessions/{id}.json` (atomic writes, Zod-validated on load).
The active session id is tracked at `~/.tp-scroll/active.json`.

Offline mode (no network): set `TP_SCROLL_NETWORK=off` and the holiday provider falls back to the bundled `date-holidays` package.

## Development

```bash
pnpm -r typecheck    # strict TypeScript across all packages
pnpm -r lint         # ESLint
pnpm -r test         # vitest (unit + property + smoke)
pnpm -r build        # tsc for libraries, tsup for the CLI
```

## License

MIT — see [LICENSE](LICENSE).
