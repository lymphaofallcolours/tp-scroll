# Desktop app — run, install, release

The `@tp-scroll/desktop` package is an Electron application. There are three
ways to use it: run from source, build a local installer, or download a
published release.

## Run from source (development)

```bash
pnpm install
pnpm --filter @tp-scroll/desktop run dev
```

`dev` starts the Vite renderer on port 5173, waits for it, bundles the Electron
main process, and launches Electron with hot reload.

## Build a local installer

To produce a clickable, installable app on Linux:

```bash
pnpm --filter @tp-scroll/desktop run dist:linux
```

This builds the renderer + main bundle and runs `electron-builder`, writing two
artifacts to `packages/desktop/release/`:

| Artifact | How to use it |
|---|---|
| `tp-scroll-<version>-x86_64.AppImage` | Portable. `chmod +x` it, then double-click (or run it). No installation; delete the file to remove. |
| `tp-scroll-<version>-amd64.deb` | Installs into your system app menu with an icon. `sudo apt install ./tp-scroll-<version>-amd64.deb`. Launch from your application launcher like any native app; remove with `sudo apt remove tp-scroll`. |

The app is **fully self-contained**: the main process is bundled (via tsup) with
all of its runtime dependencies, including the `date-holidays` dataset, so the
installer ships only `dist/` — no `node_modules`.

### App icon

The icon lives at `packages/desktop/packaging/icon.png` (a 512×512 PNG). Replace
that file with your own — no config change needed. It is **not** under the
gitignored `build/` directory precisely so it can be committed and used by CI.

## Published releases (GitHub)

Tagged versions are built in CI and attached to a GitHub Release, so anyone can
download the AppImage or `.deb` without building locally.

**To cut a release**, push a tag whose number matches
`packages/desktop/package.json`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The [`Release` workflow](../.github/workflows/release.yml) (triggered on `v*`
tags) builds the Linux installers and runs `electron-builder --publish always`,
which creates the GitHub Release for that tag and uploads both artifacts. It
authenticates with the workflow's built-in `GITHUB_TOKEN` — no extra secret to
configure.

Download published artifacts from the repository's **Releases** page.

> Currently Linux-only (the maintainer's platform). Adding macOS/Windows is a
> matter of extending the `release.yml` matrix and the `electron-builder.yml`
> targets — see [`design/0013-desktop-packaging-and-releases.md`](design/0013-desktop-packaging-and-releases.md).
