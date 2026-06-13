import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { registerIpc } from "./ipc.js";
import { initAutoUpdater } from "./updater.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env["NODE_ENV"] === "development";

const createWindow = async (): Promise<void> => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#f4ede0",
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
