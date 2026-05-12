# ADR 0003 — JSON files (one per session) for storage in v0.1

**Status:** Accepted (2026-05-12)

## Context

Session data is small (kilobytes), schema-rich, and read/written infrequently. The user is the only writer. No multi-process contention. We need atomicity, easy human inspection, and easy backup.

## Decision

- One JSON file per session at `~/.tp-scroll/sessions/{id}.json`.
- Atomic writes via temp-then-rename: write to `{id}.json.tmp`, then `rename()` over the target. POSIX rename is atomic on the same filesystem.
- Loads validate with Zod. Corrupted files are refused with a clear error; they are never silently recovered.

## Alternatives rejected

- **SQLite** — overkill for v0.1. Adds a native dep, a migration story, and a concurrent-write story we don't need yet. Revisit if the data model grows to span many sessions or needs cross-session queries.
- **A single JSON file** — atomic writes still possible, but every session edit rewrites the whole blob. Doesn't scale and corrupts everything on a bug.

## Consequences

- Files are user-readable and version-controllable by hand if desired.
- Migration story: add a `schemaVersion` field to the session; the loader applies migrations before Zod-parsing.
- Future v0.3+ could swap in SQLite behind the same `SessionStore` interface.
