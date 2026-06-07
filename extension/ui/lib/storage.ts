import type { EncryptedVault, StorageBackend } from '@/lib/types'

// Server + file helpers are reused unmodified from the shared lib. We import via
// a RELATIVE path so this module (which the Vite alias maps @/lib/storage to)
// doesn't import itself. The File System Access API works in an extension page,
// so file import/export needs no change.
export {
  exportVaultToFile,
  importVaultFromFile,
  listServerVaults,
  createServerVault,
  probeServer,
  loginServer,
  verifyServerOtp,
  inviteToVault,
} from '../../../lib/storage'
export type { RemoteConfig } from '../../../lib/storage'

import {
  loadVault as sharedLoadVault,
  saveVault as sharedSaveVault,
  type RemoteConfig,
} from '../../../lib/storage'

// The background worker (autofill + passkeys) reads the encrypted vault from
// chrome.storage.local under this key — the same blob shape it has always used.
const VAULT_KEY = 'rokoVault'

async function localGet(): Promise<EncryptedVault | null> {
  const out = await chrome.storage.local.get(VAULT_KEY)
  return (out[VAULT_KEY] as EncryptedVault | undefined) ?? null
}

async function localSet(vault: EncryptedVault): Promise<void> {
  await chrome.storage.local.set({ [VAULT_KEY]: vault })
}

/**
 * Load the encrypted vault. For the local backend it comes from
 * chrome.storage.local; for remote we defer to the shared server fetch.
 */
export async function loadVault(
  backend: StorageBackend,
  vaultId: string,
  remote?: RemoteConfig,
): Promise<EncryptedVault | null> {
  if (backend === 'remote') return sharedLoadVault('remote', vaultId, remote)
  return localGet()
}

/**
 * Save the encrypted vault. Remote saves go to the server; in every case we also
 * mirror the blob into chrome.storage.local so the background autofill worker has
 * a local encrypted copy to decrypt with the session key (works for remote vaults
 * too, even while the popup/tab is closed).
 */
export async function saveVault(
  backend: StorageBackend,
  vaultId: string,
  vault: EncryptedVault,
  remote?: RemoteConfig,
): Promise<void> {
  if (backend === 'remote') {
    await sharedSaveVault('remote', vaultId, vault, remote)
  }
  await localSet(vault)
}

/** Clear the locally-mirrored vault. */
export async function deleteLocalVault(): Promise<void> {
  await chrome.storage.local.remove(VAULT_KEY)
}
