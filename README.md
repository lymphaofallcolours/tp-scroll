# tp-scroll

Optimize annual leave around weekends and public holidays — maximize time at home when living abroad.

A TypeScript monorepo with a pure domain core, pluggable adapters for public-holiday providers and session storage, and a thin CLI to validate the engine end-to-end.

## Status

**v0.1** — engine + CLI smoke test. See [`docs/`](docs/) for the user-facing reference and [`docs/design/`](docs/design/) for architecture decisions.

## Quickstart

```bash
pnpm install
pnpm -r build
pnpm --filter @tp-scroll/cli run start -- session new --name "2026" --residence DE --home ES
pnpm --filter @tp-scroll/cli run start -- cycle set --kind calendar --total-days 25
pnpm --filter @tp-scroll/cli run start -- plan
```

## Development

```bash
pnpm -r typecheck   # strict TypeScript
pnpm -r lint        # ESLint
pnpm -r test        # vitest (unit + property tests)
```

Requires **Node ≥ 22** (native Temporal API). On Node 20 you can opt in to the `@js-temporal/polyfill` — see [`docs/dependencies.md`](docs/dependencies.md).

## License

MIT — see [LICENSE](LICENSE).
