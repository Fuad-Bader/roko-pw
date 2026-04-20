import type { EncryptedVault, StorageBackend, VaultMeta } from './types'

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

export interface RemoteConfig {
  serverUrl: string  // e.g. "https://vault.example.com"
  token: string      // bearer token from server session
}

/** Load the encrypted vault blob from local IndexedDB or the remote server. */
export async function loadVault(
  backend: StorageBackend,
  vaultId: string,
  remote?: RemoteConfig,
): Promise<EncryptedVault | null> {
  if (backend === 'local') {
    return (await idbGet('vault')) as EncryptedVault | null
  }
  const base = remote?.serverUrl ?? ''
  const res = await fetch(`${base}/api/vaults/${encodeURIComponent(vaultId)}`, {
    headers: remote ? { Authorization: `Bearer ${remote.token}` } : {},
  })
  if (!res.ok) return null
  return (await res.json()) as EncryptedVault | null
}

/** Persist the encrypted vault blob to local IndexedDB or the remote server. */
export async function saveVault(
  backend: StorageBackend,
  vaultId: string,
  vault: EncryptedVault,
  remote?: RemoteConfig,
): Promise<void> {
  if (backend === 'local') {
    await idbSet('vault', vault)
    return
  }
  const base = remote?.serverUrl ?? ''
  const res = await fetch(`${base}/api/vaults/${encodeURIComponent(vaultId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(remote ? { Authorization: `Bearer ${remote.token}` } : {}),
    },
    body: JSON.stringify(vault),
  })
  if (!res.ok) throw new Error('Failed to save vault to remote server')
}

// ─── Server-specific helpers ─────────────────────────────────────────────────

/** Fetch the list of vaults the authenticated user has on a server. */
export async function listServerVaults(remote: RemoteConfig): Promise<VaultMeta[]> {
  const res = await fetch(`${remote.serverUrl}/api/vaults`, {
    headers: { Authorization: `Bearer ${remote.token}` },
  })
  if (!res.ok) throw new Error('Failed to list vaults')
  return (await res.json()) as VaultMeta[]
}

/** Create a new vault on the server and return its metadata. */
export async function createServerVault(remote: RemoteConfig, name: string): Promise<VaultMeta> {
  const res = await fetch(`${remote.serverUrl}/api/vaults`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${remote.token}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create vault')
  return (await res.json()) as VaultMeta
}

/** Check that a URL points to a live RokoPW server. Returns the server's display name. */
export async function probeServer(url: string): Promise<string> {
  const res = await fetch(`${url.replace(/\/$/, '')}/`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Server returned ${res.status}`)
  const body = await res.json() as { kind?: string; name?: string }
  if (body.kind !== 'roko-pw-server') throw new Error('URL does not point to a RokoPW server')
  return body.name ?? 'RokoPW Server'
}

/** Request an OTP to be sent to the given email. */
export async function requestServerOtp(serverUrl: string, email: string): Promise<void> {
  const res = await fetch(`${serverUrl}/api/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const body = await res.json() as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Failed to send login code')
}

/** Verify the OTP and return a session token + expiry. */
export async function verifyServerOtp(
  serverUrl: string,
  email: string,
  otp: string,
): Promise<{ token: string; expiresAt: number }> {
  const res = await fetch(`${serverUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
  const body = await res.json() as { token?: string; expiresAt?: number; error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Invalid or expired code')
  return { token: body.token!, expiresAt: body.expiresAt! }
}

/** Invite another user to a vault. The vault password is sent in the email. */
export async function inviteToVault(
  remote: RemoteConfig,
  vaultId: string,
  email: string,
  vaultPassword: string,
): Promise<void> {
  const res = await fetch(`${remote.serverUrl}/api/vaults/${vaultId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${remote.token}` },
    body: JSON.stringify({ email, vaultPassword }),
  })
  const body = await res.json() as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Failed to send invite')
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
