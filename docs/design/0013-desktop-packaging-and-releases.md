# ADR 0013 — Desktop packaging & GitHub releases

**Status:** Accepted (2026-06-13)

Builds on [0007-electron-architecture](./0007-electron-architecture.md).

## Context

The desktop app could only be run from source (`pnpm dev`, or `electron .`
against a local build). The user wanted to launch it like a regular app from an
icon, and to download new versions as the project evolves.

## Decision

Package `@tp-scroll/desktop` with **electron-builder** into a Linux **AppImage**
(portable, double-click) and **`.deb`** (installs into the system app menu).
Publish both as **GitHub Releases** on every `v*` tag via a CI workflow.

### Self-contained bundle (no `node_modules` shipped)

The main process already left third-party deps (`zod`, `date-holidays`)
external, relying on `node_modules` at runtime — fine for `electron .`, broken
for a packaged app. pnpm's symlinked `node_modules` is also awkward for
electron-builder to copy.

**We bundle everything except `electron` into `dist/electron/main.js`** (tsup /
esbuild) and ship only `dist/` + `package.json`
(`files: [dist/**, package.json]`). This is the fewest-moving-parts option, it
sidesteps pnpm packaging pitfalls entirely, and it matches the existing
`@tp-scroll/*` bundling. `date-holidays` inlines its JSON dataset when bundled
(verified: a launched packaged app resolves real holidays).

**Gotcha that cost a rebuild:** a catch-all `noExternal: [/.*/]` also matches
`"electron"`, and tsup's `noExternal` overrides `external` — so Electron's
CommonJS `index.js` got pulled into the ESM bundle, where esbuild's `require`
shim throws `Dynamic require of "fs" is not supported` at startup. The fix is a
negative-lookahead regex `^(?!electron(\/|$)).+` so electron stays external.

### Config choices

- `artifactName: tp-scroll-${version}-${arch}.${ext}` — hardcoded base because
  `${name}` expands to the scoped `@tp-scroll/desktop`, whose `/` breaks the
  output path.
- `linux.executableName: tp-scroll` — otherwise the binary is `@tp-scrolldesktop`.
- `directories.buildResources: packaging` — **not** the electron-builder default
  `build`, which is gitignored repo-wide; the committed icon lives at
  `packaging/icon.png`.
- `publish: { provider: github }` + workflow `--publish always` with the
  built-in `GITHUB_TOKEN` (`permissions: contents: write`). No extra secret.

### Release flow

Push a tag matching the package version (`git tag v1.0.0 && git push origin
v1.0.0`); `.github/workflows/release.yml` builds and uploads the installers to
the tag's GitHub Release.

## Consequences

- Users get clickable installers, downloadable per version from the Releases page.
- Linux-only for now (the maintainer's platform). macOS/Windows = extend the
  `electron-builder.yml` targets + the workflow runner matrix; the self-contained
  bundle strategy carries over unchanged.
- The CI `Release` job is separate from the existing `CI` verify job; tag pushes
  don't run typecheck/lint/test (those gate `main` and PRs).
