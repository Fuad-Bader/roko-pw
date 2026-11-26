"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  loadVault: () => electron.ipcRenderer.invoke("vault:load"),
  saveVault: (vault) => electron.ipcRenderer.invoke("vault:save", vault),
  exportVault: (vault) => electron.ipcRenderer.invoke("vault:export", vault),
  importVault: () => electron.ipcRenderer.invoke("vault:import"),
  window: {
    minimize: () => electron.ipcRenderer.invoke("window:minimize"),
    maximize: () => electron.ipcRenderer.invoke("window:maximize"),
    close: () => electron.ipcRenderer.invoke("window:close"),
    isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized")
  }
});
