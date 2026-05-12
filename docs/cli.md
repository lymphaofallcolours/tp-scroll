# CLI Reference

> Status: v0.1 — engine smoke test. Commands accept dates as `YYYY-MM-DD`.

## Sessions

```bash
tp-scroll session new --name "2026 PhD year" --residence DE --home ES
tp-scroll session list
tp-scroll session use <id>
```

## Leave cycle

```bash
tp-scroll cycle set --kind calendar --total-days 25 --carryover lose
```

`--kind`: `calendar | fiscal | anniversary`
`--carryover`: `lose | cumulative`

## Trips

```bash
tp-scroll trips add --from 2026-04-10 --to 2026-04-18
tp-scroll trips list
```

## Constraints

```bash
tp-scroll blocked add --from 2026-09-01 --to 2026-09-30 --reason "teaching"
tp-scroll anchors add --day 2026-12-24 --prefer home --weight 10
```

## Status & planning

```bash
tp-scroll status     # consumed, remaining, schengen summary
tp-scroll plan       # runs optimizer, prints top 5 plans
```

## Storage

Sessions are stored under `~/.tp-scroll/sessions/{id}.json`. Writes are atomic (temp-then-rename); loads are Zod-validated and refuse corrupted files with a clear error.

## Offline operation

If `https://date.nager.at` is unreachable, the CLI falls back to the bundled `date-holidays` package automatically. Set `TP_SCROLL_NETWORK=off` to force offline mode in tests.
