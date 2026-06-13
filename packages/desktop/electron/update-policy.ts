// Pure decision logic for auto-update — no electron / electron-updater imports
// so it stays unit-testable outside the Electron runtime.

/**
 * Auto-update only makes sense for a packaged **AppImage** build:
 * electron-updater can download a new AppImage and swap it in place, but it
 * cannot update a system-package (`.deb`) install — those are owned by the OS
 * package manager. Development (unpackaged) runs are skipped entirely, as are
 * platforms we don't yet ship installers for.
 *
 * An AppImage run is identified by the `APPIMAGE` env var, which the AppImage
 * runtime sets to the path of the running image.
 */
export const shouldAutoUpdate = (
  isPackaged: boolean,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): boolean => {
  const appImagePath = env["APPIMAGE"];
  return (
    isPackaged && platform === "linux" && typeof appImagePath === "string" && appImagePath.length > 0
  );
};
