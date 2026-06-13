# Packaging assets

`icon.png` is the application icon used by `electron-builder` for the Linux
AppImage and `.deb` (and as the source for the window/taskbar icon).

- It is a square **512×512** PNG (the project logo, `images/tpscroll-logo-512.png`).
  electron-builder derives all smaller sizes from it.
- To change it, replace this file with another square PNG (512×512 or larger).
  Keep the filename `icon.png` — `electron-builder.yml` points at this path, so
  swapping the file is all that's needed, no config change.

> This directory is the electron-builder `buildResources` dir. It is **not**
> named `build/` on purpose: that name is gitignored repo-wide, which would stop
> the icon from being committed and break CI release builds.
