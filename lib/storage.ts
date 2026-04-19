import type { EncryptedVault, StorageBackend } from './types'

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME = 'roko-vault'
const STORE = 'vault'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load the encrypted vault blob from local IndexedDB or the remote API. */
export async function loadVault(
  backend: StorageBackend,
  vaultId: string,
): Promise<EncryptedVault | null> {
  if (backend === 'local') {
    return (await idbGet('vault')) as EncryptedVault | null
  }
  const res = await fetch(`/api/vault?id=${encodeURIComponent(vaultId)}`)
  if (!res.ok) return null
  const data = await res.json() as EncryptedVault | null
  return data
}

/** Persist the encrypted vault blob to local IndexedDB or the remote API. */
export async function saveVault(
  backend: StorageBackend,
  vaultId: string,
  vault: EncryptedVault,
): Promise<void> {
  if (backend === 'local') {
    await idbSet('vault', vault)
    return
  }
  const res = await fetch('/api/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: vaultId, vault }),
  })
  if (!res.ok) throw new Error('Failed to save vault to remote server')
}

/** Delete the local vault from IndexedDB. */
export async function deleteLocalVault(): Promise<void> {
  await idbDelete('vault')
}
