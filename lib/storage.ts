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

// ─── File System Access API (with <input type=file> fallback) ─────────────────

const FILE_OPTS = {
  description: 'RokoPW Vault',
  accept: { 'application/json': ['.rkpw', '.json'] },
} as const

/**
 * Save an encrypted vault to the local file system.
 * Uses the File System Access API in supporting browsers (Chrome, Edge, Brave)
 * and falls back to a programmatic anchor-click download in others (Firefox).
 */
export async function exportVaultToFile(vault: EncryptedVault): Promise<void> {
  const json = JSON.stringify(vault, null, 2)

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    // File System Access API
    const handle = await (
      window as Window & { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }
    ).showSaveFilePicker({
      suggestedName: 'roko-vault.rkpw',
      types: [{ description: FILE_OPTS.description, accept: FILE_OPTS.accept }],
    })
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
  } else {
    // Fallback: trigger a browser download
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'roko-vault.rkpw'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}

/**
 * Open an encrypted vault from the local file system.
 * Throws `DOMException (AbortError)` if the user cancels — callers should swallow that.
 */
export async function importVaultFromFile(): Promise<EncryptedVault> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    const [handle] = await (
      window as Window & { showOpenFilePicker: (o: unknown) => Promise<FileSystemFileHandle[]> }
    ).showOpenFilePicker({
      types: [{ description: FILE_OPTS.description, accept: FILE_OPTS.accept }],
      multiple: false,
    })
    const file = await handle.getFile()
    return JSON.parse(await file.text()) as EncryptedVault
  }

  // Fallback: hidden <input type="file">
  return new Promise<EncryptedVault>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.rkpw,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { reject(new DOMException('No file selected', 'AbortError')); return }
      try {
        resolve(JSON.parse(await file.text()) as EncryptedVault)
      } catch {
        reject(new Error('Invalid vault file — could not parse JSON.'))
      }
    }
    input.oncancel = () => reject(new DOMException('Cancelled', 'AbortError'))
    input.click()
  })
}
