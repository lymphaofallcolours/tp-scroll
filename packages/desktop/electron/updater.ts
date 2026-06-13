import { app } from "electron";
import electronUpdater from "electron-updater";

import { shouldAutoUpdate } from "./update-policy.js";

const { autoUpdater } = electronUpdater;

/**
 * Check the GitHub releases feed and, if a newer version exists, download it in
 * the background and show a native notification — electron-updater installs it
 * on quit. The update feed is configured at build time from electron-builder's
 * `publish` block (app-update.yml is bundled into the packaged app).
 *
 * No-op outside a packaged AppImage (see `shouldAutoUpdate`). Any failure
 * (offline, feed missing, non-AppImage) is swallowed with a log line so it can
 * never take down app startup.
 */
export const initAutoUpdater = (): void => {
  if (!shouldAutoUpdate(app.isPackaged, process.platform, process.env)) return;

  autoUpdater.autoDownload = true;
  autoUpdater.on("error", (err) => console.warn("[updater] error:", err.message));
  autoUpdater.on("update-available", (info) => console.log(`[updater] update available: ${info.version}`));
  autoUpdater.on("update-downloaded", (info) =>
    console.log(`[updater] ${info.version} downloaded — will install on quit`),
  );

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn("[updater] check failed:", err instanceof Error ? err.message : err);
  });
};
