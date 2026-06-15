import { app, BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { registerIpc } from "./ipc.js";
import { initAutoUpdater } from "./updater.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env["NODE_ENV"] === "development";

// Electron derives the X11 WM_CLASS from the app name; left as the scoped
// package name ("@tp-scroll/desktop") it won't match StartupWMClass=tp-scroll
// in the installed .desktop file, so the taskbar can't find the launcher icon.
app.setName("tp-scroll");

// On Linux the build icon is NOT auto-applied to the running window — without
// an explicit icon the window has no _NET_WM_ICON and the taskbar shows a
// generic placeholder. Bundled at app-root/packaging/icon.png (see
// electron-builder.yml files + dev runs straight from source).
const linuxIconPath = join(app.getAppPath(), "packaging", "icon.png");

const createWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#f4ede0",
    ...(process.platform === "linux" && existsSync(linuxIconPath)
      ? { icon: linuxIconPath }
      : {}),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      const levelName = ["DEBUG", "LOG", "WARN", "ERROR"][level] ?? `LEVEL${level}`;
      console.log(`[renderer ${levelName}] ${message} (${sourceId}:${line})`);
    });
    await win.loadURL("http://localhost:5173");
  } else {
    await win.loadFile(join(__dirname, "../renderer/index.html"));
  }
};

void app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
