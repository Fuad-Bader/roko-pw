import type { EncryptedVault } from '@/lib/types'

declare global {
  interface Window {
    electronAPI: {
      loadVault(): Promise<EncryptedVault | null>
      saveVault(vault: EncryptedVault): Promise<void>
      exportVault(vault: EncryptedVault): Promise<boolean>
      importVault(): Promise<EncryptedVault | null>
    }
  }
}

// Same shape as the web lib/storage.ts so VaultProvider works unmodified.
// Electron stores the personal vault in userData/vault.rkpw. Org vaults are
// never stored on the device (they are read and written through lib/orgApi.ts).

export async function loadVault(): Promise<EncryptedVault | null> {
  return window.electronAPI.loadVault()
}

export async function saveVault(vault: EncryptedVault): Promise<void> {
  return window.electronAPI.saveVault(vault)
}

export async function deleteLocalVault(): Promise<void> {
  // Overwrite with nothing — the file stays, vault is effectively cleared on next save
}

export async function exportVaultToFile(vault: EncryptedVault): Promise<void> {
  await window.electronAPI.exportVault(vault)
}

export async function importVaultFromFile(): Promise<EncryptedVault> {
  const vault = await window.electronAPI.importVault()
  // null means user cancelled the dialog
  if (!vault) throw new DOMException('Cancelled', 'AbortError')
  return vault
}
