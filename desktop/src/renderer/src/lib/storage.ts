import type { EncryptedVault, StorageBackend } from '@/lib/types'

// Server-related helpers live in the shared lib — re-export them here via relative
// path so the Vite alias override for @/lib/storage doesn't create a circular import.
export type { RemoteConfig } from '../../../../../lib/storage'
export {
  listServerVaults,
  createServerVault,
  probeServer,
  requestServerOtp,
  verifyServerOtp,
  inviteToVault,
} from '../../../../../lib/storage'

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

// These signatures match the web storage.ts so VaultProvider works unmodified.
// The backend/vaultId params are ignored — Electron always stores in userData/vault.rkpw.

export async function loadVault(
  _backend: StorageBackend,
  _id: string,
  _remote?: unknown,
): Promise<EncryptedVault | null> {
  return window.electronAPI.loadVault()
}

export async function saveVault(
  _backend: StorageBackend,
  _id: string,
  vault: EncryptedVault,
  _remote?: unknown,
): Promise<void> {
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
