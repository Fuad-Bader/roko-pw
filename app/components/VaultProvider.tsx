'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type {
  EncryptedVault,
  VaultEntry,
  EntryDraft,
  Collection,
  VaultMeta,
  VaultSettings,
  VaultStatus,
  ServerSession,
} from '@/lib/types'
import {
  decryptData,
  deriveKey,
  encryptData,
  randomSalt,
  wrapKey,
  unwrapKey,
} from '@/lib/crypto'
import {
  loadVault,
  saveVault,
  exportVaultToFile,
  importVaultFromFile,
  listServerVaults,
  createServerVault,
  probeServer,
  loginServer,
  verifyServerOtp,
  inviteToVault,
  type RemoteConfig,
} from '@/lib/storage'
import { generateMnemonic } from '@/lib/mnemonic'

// ─── Context shape ────────────────────────────────────────────────────────────

interface VaultContextValue {
  status: VaultStatus
  entries: VaultEntry[]
  collections: Collection[]
  settings: VaultSettings
  error: string | null

  /**
   * The in-memory AES vault key while unlocked, else null. Surfaced so the
   * browser extension can hand it to its background worker for autofill; the
   * web and desktop apps ignore it. Keys are extractable (see lib/crypto.ts).
   */
  cryptoKey: CryptoKey | null

  needsNewPassword: boolean
  recoveryPhrase: string[] | null

  // ── Auth ──────────────────────────────────────────────────────────────────
  unlock: (password: string) => Promise<void>
  lock: () => void
  createVault: (password: string) => Promise<void>
  recoverWithPhrase: (words: string[]) => Promise<void>
  changeMasterPassword: (newPassword: string) => Promise<void>

  // ── Recovery ──────────────────────────────────────────────────────────────
  setupRecovery: () => Promise<void>
  clearRecoveryPhrase: () => void
  hasRecovery: boolean

  // ── File I/O ──────────────────────────────────────────────────────────────
  exportToFile: () => Promise<void>
  importFromFile: () => Promise<boolean>

  // ── Entry CRUD ───────────────────────────────────────────────────────────
  addEntry: (draft: EntryDraft, collectionId?: string | null) => Promise<void>
  updateEntry: (id: string, patch: Partial<EntryDraft>) => Promise<void>
  /** Soft-delete: move an entry to the Trash. */
  trashEntry: (id: string) => Promise<void>
  /** Restore an entry from the Trash. */
  restoreEntry: (id: string) => Promise<void>
  /** Permanently remove an entry (from the Trash). */
  deleteForever: (id: string) => Promise<void>
  /** Toggle an entry's Favorite (star) flag. */
  toggleFavorite: (id: string) => Promise<void>
  /** Move an entry into a collection, or out of all collections (null). */
  moveEntryToCollection: (id: string, collectionId: string | null) => Promise<void>

  // ── Collections ────────────────────────────────────────────────────────────
  addCollection: (name: string) => Promise<Collection>
  renameCollection: (id: string, name: string) => Promise<void>
  /** Delete a collection. Its entries are kept but become uncategorised. */
  deleteCollection: (id: string) => Promise<void>

  // ── Settings ──────────────────────────────────────────────────────────────
  applySettings: (patch: Partial<VaultSettings>) => Promise<void>
  clearError: () => void

  // ── Server session ────────────────────────────────────────────────────────
  serverSession: ServerSession | null
  serverVaults: VaultMeta[]
  serverLoading: boolean

  /** Verify the server URL is a live RokoPW server. Returns the server name. */
  probeServer: (url: string) => Promise<string>
  /** Step 1 of sign-in: submit email + password; server emails an OTP. Returns whether this is a new account. */
  login: (serverUrl: string, email: string, password: string) => Promise<{ newAccount: boolean }>
  /** Step 2 of sign-in: verify OTP (with password) and store the session. */
  verifyOtp: (serverUrl: string, email: string, otp: string, password: string) => Promise<void>
  /** Log out of the current server session. */
  logoutServer: () => void
  /** Reload the vault list from the server. */
  refreshServerVaults: () => Promise<void>
  /** Create a new vault on the connected server. */
  createServerVault: (name: string) => Promise<VaultMeta>
  /** Whether a server vault already has an encrypted blob (false = needs a password set). */
  serverVaultHasData: (vaultId: string) => Promise<boolean>
  /**
   * Set the vault password for a server vault that has no blob yet (new or
   * orphaned): writes its first encrypted blob (with a recovery phrase) and
   * opens it unlocked. Shows the recovery phrase via the dashboard modal.
   */
  initRemoteVault: (vaultId: string, password: string) => Promise<void>
  /**
   * Upload the currently-open vault to the connected server: creates a new
   * server vault, pushes the current entries (encrypted with the existing key,
   * so the same master password unlocks it), and switches to remote sync.
   */
  uploadVaultToServer: (name: string) => Promise<VaultMeta>
  /** Invite a user to the current vault by email (sends them the vault password). */
  inviteUser: (email: string, vaultPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

const SETTINGS_KEY = 'roko-settings'
const SESSION_KEY = 'roko-server-session'

function readSettings(): VaultSettings {
  if (typeof window === 'undefined') return { backend: 'local', vaultId: '', serverUrl: '' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VaultSettings>
      return {
        backend: parsed.backend ?? 'local',
        vaultId: parsed.vaultId ?? crypto.randomUUID(),
        serverUrl: parsed.serverUrl ?? '',
      }
    }
  } catch { /* corrupted */ }
  const fresh: VaultSettings = { backend: 'local', vaultId: crypto.randomUUID(), serverUrl: '' }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(fresh))
  return fresh
}

function writeSettings(s: VaultSettings) {
  if (typeof window !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

function readSession(): ServerSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as ServerSession
    if (s.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

function writeSession(s: ServerSession | null) {
  if (typeof window === 'undefined') return
  if (s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

function remoteConfig(session: ServerSession | null): RemoteConfig | undefined {
  if (!session) return undefined
  return { serverUrl: session.serverUrl, token: session.token }
}

// Fill in fields added after a vault was first written, so older entries (and
// entries from vaults created before typed items existed) load cleanly.
function normalizeEntry(e: Partial<VaultEntry> & { id: string }): VaultEntry {
  const now = Date.now()
  return {
    id: e.id,
    type: e.type ?? 'login',
    title: e.title ?? '',
    url: e.url ?? '',
    username: e.username ?? '',
    password: e.password ?? '',
    notes: e.notes ?? '',
    favorite: !!e.favorite,
    collectionId: e.collectionId ?? null,
    deletedAt: e.deletedAt ?? null,
    cardNumber: e.cardNumber,
    cardholder: e.cardholder,
    expiry: e.expiry,
    cvv: e.cvv,
    createdAt: e.createdAt ?? now,
    updatedAt: e.updatedAt ?? now,
  }
}

// Decrypted payloads were originally a bare VaultEntry[]; they are now
// { entries, collections }. Accept both so existing vaults keep working.
function parseVaultData(json: string): { entries: VaultEntry[]; collections: Collection[] } {
  const raw = JSON.parse(json) as
    | Array<Partial<VaultEntry> & { id: string }>
    | { entries?: Array<Partial<VaultEntry> & { id: string }>; collections?: Collection[] }
  const rawEntries = Array.isArray(raw) ? raw : raw.entries ?? []
  const collections = Array.isArray(raw) ? [] : raw.collections ?? []
  return { entries: rawEntries.map(normalizeEntry), collections }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('checking')
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [vaultSalt, setVaultSalt] = useState('')
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [settings, setSettings] = useState<VaultSettings>({ backend: 'local', vaultId: '', serverUrl: '' })
  const [error, setError] = useState<string | null>(null)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[] | null>(null)
  const [hasRecovery, setHasRecovery] = useState(false)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

  const [serverSession, setServerSession] = useState<ServerSession | null>(null)
  const [serverVaults, setServerVaults] = useState<VaultMeta[]>([])
  const [serverLoading, setServerLoading] = useState(false)

  useEffect(() => {
    const s = readSettings()
    setSettings(s)
    const session = readSession()
    setServerSession(session)
    const rc = remoteConfig(session)
    loadVault(s.backend, s.vaultId, rc)
      .then((v) => {
        setStatus(v ? 'locked' : 'empty')
        setHasRecovery(!!v?.recovery)
      })
      .catch(() => setStatus('empty'))
  }, [])

  // ─── Persist helper ────────────────────────────────────────────────────────

  const persist = useCallback(
    async (
      key: CryptoKey,
      salt: string,
      data: VaultEntry[],
      cols: Collection[],
      s: VaultSettings,
      session: ServerSession | null,
      existingVault?: EncryptedVault | null,
    ) => {
      const { iv, ciphertext } = await encryptData(
        key,
        JSON.stringify({ entries: data, collections: cols }),
      )
      const blob: EncryptedVault = {
        version: 1,
        salt,
        iv,
        ciphertext,
        ...(existingVault?.recovery ? { recovery: existingVault.recovery } : {}),
      }
      await saveVault(s.backend, s.vaultId, blob, remoteConfig(session))
      return blob
    },
    [],
  )

  // Apply a mutation to the entries/collections and persist it.
  const commit = useCallback(
    async (nextEntries: VaultEntry[], nextCollections: Collection[]) => {
      if (!cryptoKey) return
      setEntries(nextEntries)
      setCollections(nextCollections)
      const session = readSession()
      const existing = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
      await persist(cryptoKey, vaultSalt, nextEntries, nextCollections, settings, session, existing)
    },
    [cryptoKey, vaultSalt, settings, persist],
  )

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const unlock = useCallback(async (password: string) => {
    setError(null)
    const s = readSettings()
    setSettings(s)
    const session = readSession()
    setServerSession(session)
    try {
      const blob = await loadVault(s.backend, s.vaultId, remoteConfig(session))
      if (!blob) { setStatus('empty'); setError('No vault found. Create one first.'); return }
      const key = await deriveKey(password, blob.salt)
      const { entries: data, collections: cols } = parseVaultData(
        await decryptData(key, blob.iv, blob.ciphertext),
      )
      setCryptoKey(key)
      setVaultSalt(blob.salt)
      setEntries(data)
      setCollections(cols)
      setHasRecovery(!!blob.recovery)
      setStatus('unlocked')
    } catch {
      setError('Incorrect master password or corrupted vault.')
    }
  }, [])

  const lock = useCallback(() => {
    setCryptoKey(null)
    setVaultSalt('')
    setEntries([])
    setError(null)
    setNeedsNewPassword(false)
    setRecoveryPhrase(null)
    setStatus('locked')
  }, [])

  const createVault = useCallback(
    async (password: string) => {
      setError(null)
      const s = readSettings()
      setSettings(s)
      const session = readSession()
      const salt = randomSalt()
      const key = await deriveKey(password, salt)
      await persist(key, salt, [], [], s, session)
      setCryptoKey(key)
      setVaultSalt(salt)
      setEntries([])
      setCollections([])
      setHasRecovery(false)
      setStatus('unlocked')
    },
    [persist],
  )

  const recoverWithPhrase = useCallback(async (words: string[]) => {
    setError(null)
    const s = readSettings()
    setSettings(s)
    const session = readSession()
    try {
      const blob = await loadVault(s.backend, s.vaultId, remoteConfig(session))
      if (!blob?.recovery) throw new Error('This vault has no recovery phrase set up.')
      const recoveryKey = await deriveKey(words.join(' '), blob.recovery.salt)
      const vaultKey = await unwrapKey(blob.recovery.wrappedKey, blob.recovery.iv, recoveryKey)
      const { entries: data, collections: cols } = parseVaultData(
        await decryptData(vaultKey, blob.iv, blob.ciphertext),
      )
      setCryptoKey(vaultKey)
      setVaultSalt(blob.salt)
      setEntries(data)
      setCollections(cols)
      setHasRecovery(true)
      setStatus('unlocked')
      setNeedsNewPassword(true)
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('no recovery')
          ? err.message
          : 'Incorrect recovery phrase. Check each word and try again.',
      )
    }
  }, [])

  const changeMasterPassword = useCallback(
    async (newPassword: string) => {
      if (!cryptoKey) return
      const s = readSettings()
      const session = readSession()
      const newSalt = randomSalt()
      const newKey = await deriveKey(newPassword, newSalt)
      const { iv, ciphertext } = await encryptData(
        newKey,
        JSON.stringify({ entries, collections }),
      )
      const blob: EncryptedVault = { version: 1, salt: newSalt, iv, ciphertext }
      await saveVault(s.backend, s.vaultId, blob, remoteConfig(session))
      setCryptoKey(newKey)
      setVaultSalt(newSalt)
      setHasRecovery(false)
      setNeedsNewPassword(false)
    },
    [cryptoKey, entries, collections],
  )

  // ─── Recovery ──────────────────────────────────────────────────────────────

  const setupRecovery = useCallback(async () => {
    if (!cryptoKey) return
    const s = readSettings()
    const session = readSession()
    const blob = await loadVault(s.backend, s.vaultId, remoteConfig(session))
    if (!blob) return
    const words = generateMnemonic()
    const recoverySalt = randomSalt()
    const recoveryKey = await deriveKey(words.join(' '), recoverySalt)
    const { iv, wrappedKey } = await wrapKey(cryptoKey, recoveryKey)
    const updated: EncryptedVault = { ...blob, recovery: { salt: recoverySalt, iv, wrappedKey } }
    await saveVault(s.backend, s.vaultId, updated, remoteConfig(session))
    setHasRecovery(true)
    setRecoveryPhrase(words)
  }, [cryptoKey])

  const clearRecoveryPhrase = useCallback(() => setRecoveryPhrase(null), [])

  // ─── File I/O ──────────────────────────────────────────────────────────────

  const exportToFile = useCallback(async () => {
    const s = readSettings()
    const session = readSession()
    const blob = await loadVault(s.backend, s.vaultId, remoteConfig(session))
    if (blob) await exportVaultToFile(blob)
  }, [])

  const importFromFile = useCallback(async (): Promise<boolean> => {
    try {
      const blob = await importVaultFromFile()
      if (blob.version !== 1) throw new Error('Unsupported vault version.')
      const s = readSettings()
      await saveVault('local', s.vaultId, blob)
      const updated = { ...s, backend: 'local' as const }
      writeSettings(updated)
      setSettings(updated)
      setCryptoKey(null)
      setVaultSalt('')
      setEntries([])
      setHasRecovery(!!blob.recovery)
      setNeedsNewPassword(false)
      setError(null)
      setStatus('locked')
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
      setError(err instanceof Error ? err.message : 'Failed to import vault file.')
      return false
    }
  }, [])

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const addEntry = useCallback(
    async (draft: EntryDraft, collectionId: string | null = null) => {
      const now = Date.now()
      const newEntry: VaultEntry = {
        ...draft,
        id: crypto.randomUUID(),
        favorite: false,
        collectionId,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await commit([...entries, newEntry], collections)
    },
    [entries, collections, commit],
  )

  const updateEntry = useCallback(
    async (id: string, patch: Partial<EntryDraft>) => {
      const next = entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      )
      await commit(next, collections)
    },
    [entries, collections, commit],
  )

  const trashEntry = useCallback(
    async (id: string) => {
      const next = entries.map((e) =>
        e.id === id ? { ...e, deletedAt: Date.now(), favorite: false } : e,
      )
      await commit(next, collections)
    },
    [entries, collections, commit],
  )

  const restoreEntry = useCallback(
    async (id: string) => {
      const next = entries.map((e) => (e.id === id ? { ...e, deletedAt: null } : e))
      await commit(next, collections)
    },
    [entries, collections, commit],
  )

  const deleteForever = useCallback(
    async (id: string) => {
      await commit(entries.filter((e) => e.id !== id), collections)
    },
    [entries, collections, commit],
  )

  const toggleFavorite = useCallback(
    async (id: string) => {
      const next = entries.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e))
      await commit(next, collections)
    },
    [entries, collections, commit],
  )

  const moveEntryToCollection = useCallback(
    async (id: string, collectionId: string | null) => {
      const next = entries.map((e) => (e.id === id ? { ...e, collectionId } : e))
      await commit(next, collections)
    },
    [entries, collections, commit],
  )

  // ─── Collections ─────────────────────────────────────────────────────────────

  const addCollection = useCallback(
    async (name: string): Promise<Collection> => {
      const col: Collection = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Untitled',
        createdAt: Date.now(),
      }
      await commit(entries, [...collections, col])
      return col
    },
    [entries, collections, commit],
  )

  const renameCollection = useCallback(
    async (id: string, name: string) => {
      const next = collections.map((c) =>
        c.id === id ? { ...c, name: name.trim() || c.name } : c,
      )
      await commit(entries, next)
    },
    [entries, collections, commit],
  )

  const deleteCollection = useCallback(
    async (id: string) => {
      const nextEntries = entries.map((e) =>
        e.collectionId === id ? { ...e, collectionId: null } : e,
      )
      await commit(nextEntries, collections.filter((c) => c.id !== id))
    },
    [entries, collections, commit],
  )

  // ─── Settings ──────────────────────────────────────────────────────────────

  const applySettings = useCallback(
    async (patch: Partial<VaultSettings>) => {
      const updated = { ...settings, ...patch }
      writeSettings(updated)
      setSettings(updated)
      if (cryptoKey && vaultSalt) {
        const session = readSession()
        const blob = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
        await persist(cryptoKey, vaultSalt, entries, collections, updated, session, blob)
      }
    },
    [settings, cryptoKey, vaultSalt, entries, collections, persist],
  )

  const clearError = useCallback(() => setError(null), [])

  // ─── Server session ────────────────────────────────────────────────────────

  const handleProbeServer = useCallback(async (url: string) => {
    return probeServer(url.trim().replace(/\/$/, ''))
  }, [])

  const login = useCallback(async (serverUrl: string, email: string, password: string) => {
    setError(null)
    setServerLoading(true)
    try {
      const { newAccount } = await loginServer(serverUrl, email, password)
      return { newAccount }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      throw err
    } finally {
      setServerLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(async (serverUrl: string, email: string, otp: string, password: string) => {
    setError(null)
    setServerLoading(true)
    try {
      const { token, expiresAt } = await verifyServerOtp(serverUrl, email, otp, password)
      // Fetch user details
      const meRes = await fetch(`${serverUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const me = await meRes.json() as { id: string; email: string }
      const session: ServerSession = { serverUrl, token, userId: me.id, email: me.email, expiresAt }
      writeSession(session)
      setServerSession(session)

      // Auto-fetch vault list
      const vaults = await listServerVaults({ serverUrl, token })
      setServerVaults(vaults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code')
      throw err
    } finally {
      setServerLoading(false)
    }
  }, [])

  const logoutServer = useCallback(() => {
    writeSession(null)
    setServerSession(null)
    setServerVaults([])
    // Reset to local backend
    const s = readSettings()
    const updated = { ...s, backend: 'local' as const }
    writeSettings(updated)
    setSettings(updated)
    lock()
  }, [lock])

  const refreshServerVaults = useCallback(async () => {
    const session = readSession()
    if (!session) return
    setServerLoading(true)
    try {
      const vaults = await listServerVaults({ serverUrl: session.serverUrl, token: session.token })
      setServerVaults(vaults)
    } finally {
      setServerLoading(false)
    }
  }, [])

  const handleCreateServerVault = useCallback(async (name: string): Promise<VaultMeta> => {
    const session = readSession()
    if (!session) throw new Error('Not connected to a server')
    const vault = await createServerVault({ serverUrl: session.serverUrl, token: session.token }, name)
    setServerVaults((prev) => [vault, ...prev])
    return vault
  }, [])

  const serverVaultHasData = useCallback(async (vaultId: string): Promise<boolean> => {
    const session = readSession()
    if (!session) return false
    const blob = await loadVault('remote', vaultId, remoteConfig(session))
    return !!blob
  }, [])

  const initRemoteVault = useCallback(async (vaultId: string, password: string) => {
    setError(null)
    const session = readSession()
    if (!session) throw new Error('Not connected to a server')
    // Point settings at this remote vault so subsequent saves/loads target it.
    const updated: VaultSettings = { backend: 'remote', vaultId, serverUrl: session.serverUrl }
    writeSettings(updated)
    setSettings(updated)
    // Derive the vault key and generate a recovery phrase, then write the first blob.
    const salt = randomSalt()
    const key = await deriveKey(password, salt)
    const words = generateMnemonic()
    const recoverySalt = randomSalt()
    const recoveryKey = await deriveKey(words.join(' '), recoverySalt)
    const { iv: rIv, wrappedKey } = await wrapKey(key, recoveryKey)
    const { iv, ciphertext } = await encryptData(
      key,
      JSON.stringify({ entries: [], collections: [] }),
    )
    const blob: EncryptedVault = {
      version: 1,
      salt,
      iv,
      ciphertext,
      recovery: { salt: recoverySalt, iv: rIv, wrappedKey },
    }
    await saveVault('remote', vaultId, blob, remoteConfig(session))
    setCryptoKey(key)
    setVaultSalt(salt)
    setEntries([])
    setCollections([])
    setHasRecovery(true)
    setRecoveryPhrase(words) // surfaces the recovery-phrase modal in the dashboard
    setStatus('unlocked')
  }, [])

  const uploadVaultToServer = useCallback(async (name: string): Promise<VaultMeta> => {
    setError(null)
    if (!cryptoKey || !vaultSalt) throw new Error('Unlock your vault before uploading.')
    const session = readSession()
    if (!session) throw new Error('Not connected to a server')
    // Create a fresh vault on the server to hold this data.
    const vault = await createServerVault(remoteConfig(session)!, name.trim() || 'My Vault')
    // Re-encrypt the current entries against the new remote target. We reuse the
    // existing key + salt (and any recovery blob) so the same master password
    // continues to unlock the vault after the switch.
    const existing = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
    const remote: VaultSettings = { backend: 'remote', vaultId: vault.id, serverUrl: session.serverUrl }
    await persist(cryptoKey, vaultSalt, entries, collections, remote, session, existing)
    // Point the app at the remote vault for all subsequent loads/saves.
    writeSettings(remote)
    setSettings(remote)
    setServerVaults((prev) => [vault, ...prev])
    return vault
  }, [cryptoKey, vaultSalt, entries, collections, settings, persist])

  const inviteUser = useCallback(async (email: string, vaultPassword: string) => {
    const s = readSettings()
    const session = readSession()
    if (!session) throw new Error('Not connected to a server')
    await inviteToVault(
      { serverUrl: session.serverUrl, token: session.token },
      s.vaultId,
      email,
      vaultPassword,
    )
  }, [])

  // ─── Context value ─────────────────────────────────────────────────────────

  return (
    <VaultContext.Provider
      value={{
        status,
        entries,
        collections,
        settings,
        error,
        cryptoKey,
        needsNewPassword,
        recoveryPhrase,
        hasRecovery,
        unlock,
        lock,
        createVault,
        recoverWithPhrase,
        changeMasterPassword,
        setupRecovery,
        clearRecoveryPhrase,
        exportToFile,
        importFromFile,
        addEntry,
        updateEntry,
        trashEntry,
        restoreEntry,
        deleteForever,
        toggleFavorite,
        moveEntryToCollection,
        addCollection,
        renameCollection,
        deleteCollection,
        applySettings,
        clearError,
        serverSession,
        serverVaults,
        serverLoading,
        probeServer: handleProbeServer,
        login,
        verifyOtp,
        logoutServer,
        refreshServerVaults,
        createServerVault: handleCreateServerVault,
        serverVaultHasData,
        initRemoteVault,
        uploadVaultToServer,
        inviteUser,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
