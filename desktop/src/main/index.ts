import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const VAULT_FILE = () => join(app.getPath('userData'), 'vault.rkpw')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Vault storage ───────────────────────────────────────────────────────

ipcMain.handle('vault:load', () => {
  const path = VAULT_FILE()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
})

ipcMain.handle('vault:save', (_event, vault: unknown) => {
  writeFileSync(VAULT_FILE(), JSON.stringify(vault, null, 2), 'utf-8')
})

ipcMain.handle('vault:export', async (_event, vault: unknown) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export RokoPW Vault',
    defaultPath: 'roko-vault.rkpw',
    filters: [
      { name: 'RokoPW Vault', extensions: ['rkpw'] },
      { name: 'JSON', extensions: ['json'] },
    ],
  })
  if (canceled || !filePath) return false
  writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf-8')
  return true
})

// ─── IPC: Window controls ─────────────────────────────────────────────────────

ipcMain.handle('window:minimize', (e) => e.sender.getOwnerBrowserWindow()?.minimize())
ipcMain.handle('window:maximize', (e) => {
  const win = e.sender.getOwnerBrowserWindow()
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.handle('window:close', (e) => e.sender.getOwnerBrowserWindow()?.close())
ipcMain.handle('window:isMaximized', (e) => e.sender.getOwnerBrowserWindow()?.isMaximized() ?? false)

// ─── IPC: Vault storage ───────────────────────────────────────────────────────

ipcMain.handle('vault:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open RokoPW Vault',
    filters: [{ name: 'RokoPW Vault', extensions: ['rkpw', 'json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  try {
    return JSON.parse(readFileSync(filePaths[0], 'utf-8'))
  } catch {
    throw new Error('Invalid vault file — could not parse JSON.')
  }
})
