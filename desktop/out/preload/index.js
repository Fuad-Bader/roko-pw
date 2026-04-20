"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  loadVault: () => electron.ipcRenderer.invoke("vault:load"),
  saveVault: (vault) => electron.ipcRenderer.invoke("vault:save", vault),
  exportVault: (vault) => electron.ipcRenderer.invoke("vault:export", vault),
  importVault: () => electron.ipcRenderer.invoke("vault:import")
});
