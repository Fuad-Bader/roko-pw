"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const VAULT_FILE = () => path.join(electron.app.getPath("userData"), "vault.rkpw");
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  win.on("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("vault:load", () => {
  const path2 = VAULT_FILE();
  if (!fs.existsSync(path2)) return null;
  try {
    return JSON.parse(fs.readFileSync(path2, "utf-8"));
  } catch {
    return null;
  }
});
electron.ipcMain.handle("vault:save", (_event, vault) => {
  fs.writeFileSync(VAULT_FILE(), JSON.stringify(vault, null, 2), "utf-8");
});
electron.ipcMain.handle("vault:export", async (_event, vault) => {
  const { canceled, filePath } = await electron.dialog.showSaveDialog({
    title: "Export RokoPW Vault",
    defaultPath: "roko-vault.rkpw",
    filters: [
      { name: "RokoPW Vault", extensions: ["rkpw"] },
      { name: "JSON", extensions: ["json"] }
    ]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), "utf-8");
  return true;
});
electron.ipcMain.handle("vault:import", async () => {
  const { canceled, filePaths } = await electron.dialog.showOpenDialog({
    title: "Open RokoPW Vault",
    filters: [{ name: "RokoPW Vault", extensions: ["rkpw", "json"] }],
    properties: ["openFile"]
  });
  if (canceled || !filePaths[0]) return null;
  try {
    return JSON.parse(fs.readFileSync(filePaths[0], "utf-8"));
  } catch {
    throw new Error("Invalid vault file — could not parse JSON.");
  }
});
