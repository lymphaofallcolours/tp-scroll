# ADR 0008 — Frontend design tokens (warm-paper aesthetic)

**Status:** Accepted (2026-05-13)

## Context

v1.0's desktop UI needs a coherent visual identity. The project's name (`tp-scroll`) literally references reading a scroll; the user is a PhD student planning home visits — emotional center is longing for home, optimizing precious leave. A SaaS-dashboard look (Inter, purple-gradient, blue-accent) would be wrong for this.

## Decision

An **editorial-typographic, warm-paper** aesthetic, encoded as CSS custom properties in `packages/desktop/src/styles/tokens.css`:

### Surfaces
A small range of warm cream / aged-paper tones, ordered from primary background to recessed grid cells:

| Token | Value | Use |
|---|---|---|
| `--surface-page` | `#f4ede0` | The page itself — cream paper |
| `--surface-card` | `#f8f3e9` | Lifted panels and form chrome |
| `--surface-sunk` | `#ece2cc` | Recessed (calendar residence cells) |
| `--surface-edge` | `#d4c8ad` | Hairlines, dividers, input borders |

### Ink
Three opacity steps of a single deep blue-black, plus a faint earth tone:

| Token | Value | Use |
|---|---|---|
| `--ink-primary` | `#1a2433` | Headlines, primary text, big numbers |
| `--ink-secondary` | `#3a4659` | Body text |
| `--ink-tertiary` | `#6b7488` | Labels, mono kickers |
| `--ink-faint` | `#aaa794` | Placeholders, disabled states |

### Accents
A *small* palette of three semantic accents. No purple, no electric blue:

| Token | Value | Use |
|---|---|---|
| `--accent-trip` | `#7a8e62` | Sage. Days at home — the win. |
| `--accent-holiday` | `#c08a4b` | Muted gold. Public holidays. |
| `--accent-blocked` | `#a85333` | Faded red. Blocked periods. |
| `--accent-weekend` | `#c9bea2` | Warm gray. Weekends. |

Each accent has a `*-soft` companion (the same hue desaturated and lightened) for backgrounds and dashed borders.

### Type
- **Display**: `Fraunces Variable` — variable serif (200–900 weight, 9–144 optical size, 30–100 SOFT). Used for headlines, big numbers, italic body labels.
- **Mono**: `JetBrains Mono Variable` — every date, count, balance number, label, and IPC payload. `font-variation-settings: "tnum" 1, "zero" 1` for tabular numerals.
- **No** sans-serif body face. Fraunces is the body face too, at smaller weights. Mono carries data.
- Fonts ship via `@fontsource-variable/*` and are self-hosted in the production bundle — no Google Fonts CDN at runtime.

### Motion
One orchestrated reveal per page load (`@keyframes rise` in `Calendar.module.css`) — masthead, then legend, then summary, then months, each 80 ms apart. No scattered micro-interactions. Hover transitions are 120 ms with `cubic-bezier(0.2, 0, 0, 1)` (`--ease-quiet`).

### Anti-patterns
- No utility-class framework (no Tailwind). CSS Modules + tokens.
- No `Inter` family, no purple gradients, no `Space Grotesk`, no plastic-blue.
- No animated micro-interactions on every hover — quietness is the brief.

## Alternatives rejected

- **Retro-futuristic terminal** (Berkeley Mono, amber-on-black): too aggressive for a personal time-management tool that's about being at home.
- **Soft-modern rounded pastels** (Söhne / Migra + Inter Tight): too close to wellness-app generic; loses character.
- **Brutalist zine** (TT Old + monospace, hard black borders): high personality but fights readability for dense calendar data.

## Consequences

- Every component reads tokens via CSS custom properties — no hex codes in component CSS.
- Chart.js can't read CSS custom properties at construct time, so the burndown chart maintains a small `TOKENS` JS object that mirrors the palette. Documented in `Burndown.tsx`.
- A future light-mode-only / dark-mode-only split is a re-definition of these tokens; the component tree stays untouched.
