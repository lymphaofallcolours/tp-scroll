import { describe, expect, it } from "vitest";

import { shouldAutoUpdate } from "../electron/update-policy";

describe("shouldAutoUpdate", () => {
  it("checks for updates when packaged, on linux, running as an AppImage", () => {
    expect(shouldAutoUpdate(true, "linux", { APPIMAGE: "/tmp/tp-scroll.AppImage" })).toBe(true);
  });

  it("skips in development (not packaged)", () => {
    expect(shouldAutoUpdate(false, "linux", { APPIMAGE: "/tmp/tp-scroll.AppImage" })).toBe(false);
  });

  it("skips a .deb / system-package install (no APPIMAGE env)", () => {
    // electron-updater cannot replace an apt-installed binary; the OS package
    // manager owns updates there.
    expect(shouldAutoUpdate(true, "linux", {})).toBe(false);
  });

  it("skips on non-linux platforms (no installers shipped for them yet)", () => {
    expect(shouldAutoUpdate(true, "darwin", { APPIMAGE: "/tmp/tp-scroll.AppImage" })).toBe(false);
    expect(shouldAutoUpdate(true, "win32", { APPIMAGE: "/x.AppImage" })).toBe(false);
  });

  it("treats an empty APPIMAGE value as not-an-AppImage", () => {
    expect(shouldAutoUpdate(true, "linux", { APPIMAGE: "" })).toBe(false);
  });
});
