# ADR 0011 — Bucket kinds (annual / sick / parental / conference / other)

**Status:** Accepted (2026-05-13)

## Context

The v0.2 multi-bucket budget made each `Session.buckets[]` carry its own `totalDays`, but every bucket today is *implicitly* annual leave — the optimizer picks `buckets[0]` to plan against, the calendar paints every trip in the same sage colour, and the user can't tell what kind of time each bucket represents. The original prompt's v2.5 milestone calls for "expanded leave-type buckets (sick, parental, conference travel)". This ADR records how that gets encoded.

## Decision

`LeaveBucket.kind: BucketKind` becomes a first-class discriminator. Five canonical kinds:

| Kind | Use |
|---|---|
| `annual` | Standard vacation leave (default) — the optimizer's planning target |
| `sick` | Sick days, tracked after-the-fact |
| `parental` | Parental leave, longer absences |
| `conference` | Work travel — often manually approved, separate budget |
| `other` | Anything else (jury duty, study leave, …) |

```ts
export const BucketKindSchema = z.enum(["annual", "sick", "parental", "conference", "other"]);
export type BucketKind = z.infer<typeof BucketKindSchema>;

export const LeaveBucketSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cycleId: z.string().min(1),
  totalDays: z.number().int().nonnegative(),
  kind: BucketKindSchema.default("annual"),
});
```

The `.default("annual")` is load-bearing: every session file written before v2.5 omits `kind`, and they all migrate transparently to `kind: "annual"` on the next parse — no migration script needed.

### Optimizer behaviour

`optimize()` previously defaulted `planningBucketId` to `buckets[0].id`. v2.5 changes it to:

```ts
const defaultPlanningBucket =
  session.buckets.find((b) => b.kind === "annual") ?? session.buckets[0];
```

So users can keep sick/parental buckets ahead of annual in their list without breaking the planning flow. Explicit `planningBucketId` continues to override.

### Colour token mapping

`bucketKindColor(kind: BucketKind): string` is a pure helper that returns the **name** of a CSS custom property — single source of truth shared by the calendar grid, the buckets card, and the status view. The desktop's `tokens.css` defines the actual values:

| Token | Hex | Vibe |
|---|---|---|
| `--accent-bucket-annual` | `#7a8e62` | Sage (reuses `--accent-trip` so existing layouts don't shift) |
| `--accent-bucket-sick` | `#8a6a8d` | Muted mauve |
| `--accent-bucket-parental` | `#4f7c84` | Deep teal |
| `--accent-bucket-conference` | `#b08440` | Warm amber |
| `--accent-bucket-other` | `#88837a` | Warm grey |

Each kind also gets a `*-soft` companion (desaturated/lightened) for dashed-border planned trips and chip backgrounds. All five sit comfortably inside the warm-paper palette established in [ADR 0008](0008-frontend-design-tokens.md).

### Desktop UI

- **Sessions view**: new "Buckets" card lists the active session's buckets — coloured swatch, name (id), kind chip in the soft colour, total days. A `sum N / cycle.totalDays` footer with sage ✓ when balanced or faded-red warning otherwise. Inline form behind "+ add bucket" with id / name / total-days inputs and a kind `<select>`.
- **Calendar grid**: trip cells now compose their colour from the bucket they're charged to — actuals use the main token, planned use the soft token with a dashed border in the main colour. The hover title shows `<date> — trip-* · <bucket-kind>`.
- **Demo session**: extended to 40 cycle-days with three buckets (annual 25 / sick 10 / conference 5) and matching trips — so the demo paints visibly different colours on the calendar and exercises the buckets card without manual setup.

### CLI

- `tp-scroll buckets new --id <id> --name <name> --total-days <n> --kind <kind>` (defaults to `annual`).
- `tp-scroll buckets list` adds a `kind` column.

## Alternatives considered

- **Free-form `kind: string`.** Rejected: loses the colour-mapping certainty and lets typos slip through. The Zod enum keeps the UI tight.
- **Per-kind rules in core** (e.g. "conference requires a note", "sick allows weekend consumption"). Rejected for v2.5 — those are policy decisions that vary by employer; better as a separate config field once we have a clear use case.
- **Bucket archival / deletion** in this milestone. Rejected — additive-only keeps the UX simple. Deletion needs trip-reassignment UX too, which is a v2.5.x feature.
- **Per-bucket carryover modes**. Rejected — `LeaveCycle.carryover` already applies workspace-wide; per-bucket carryover would need a richer cycle model. Defer.

## Consequences

- A new session is still single-bucket (`annual`) by default — no behaviour change for anyone who doesn't opt in.
- The schema invariant `sum(buckets[i].totalDays) === cycle.totalDays` stays; the UI's footer surfaces it inline.
- Adding a new bucket kind in the future is a one-token + one-enum-entry change. The 5-tuple of kinds is itself an opinion, not a limit — future kinds (`bereavement`, `study`) can be added without changing the discriminator shape.
- Colours touch every view that paints trips: future per-bucket-aware features (per-kind balance charts, per-kind anchor weighting) compose naturally on top of the shared token mapping.
