import { contextBridge, ipcRenderer } from 'electron'
import type { EncryptedVault } from '@/lib/types'

contextBridge.exposeInMainWorld('electronAPI', {
  loadVault: (): Promise<EncryptedVault | null> =>
    ipcRenderer.invoke('vault:load'),

  saveVault: (vault: EncryptedVault): Promise<void> =>
    ipcRenderer.invoke('vault:save', vault),

  exportVault: (vault: EncryptedVault): Promise<boolean> =>
    ipcRenderer.invoke('vault:export', vault),

  importVault: (): Promise<EncryptedVault | null> =>
    ipcRenderer.invoke('vault:import'),
})
