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
  requestServerOtp,
  verifyServerOtp,
  inviteToVault,
  type RemoteConfig,
} from '@/lib/storage'
import { generateMnemonic } from '@/lib/mnemonic'

// ─── Context shape ────────────────────────────────────────────────────────────

interface VaultContextValue {
  status: VaultStatus
  entries: VaultEntry[]
  settings: VaultSettings
  error: string | null

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
  importFromFile: () => Promise<void>

  // ── CRUD ─────────────────────────────────────────────────────────────────
  addEntry: (entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateEntry: (id: string, patch: Partial<Omit<VaultEntry, 'id' | 'createdAt'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>

  // ── Settings ──────────────────────────────────────────────────────────────
  applySettings: (patch: Partial<VaultSettings>) => Promise<void>
  clearError: () => void

  // ── Server session ────────────────────────────────────────────────────────
  serverSession: ServerSession | null
  serverVaults: VaultMeta[]
  serverLoading: boolean

  /** Verify the server URL is a live RokoPW server. Returns the server name. */
  probeServer: (url: string) => Promise<string>
  /** Send a login OTP to the given email. */
  requestOtp: (serverUrl: string, email: string) => Promise<void>
  /** Verify OTP and store the session. */
  verifyOtp: (serverUrl: string, email: string, otp: string) => Promise<void>
  /** Log out of the current server session. */
  logoutServer: () => void
  /** Reload the vault list from the server. */
  refreshServerVaults: () => Promise<void>
  /** Create a new vault on the connected server. */
  createServerVault: (name: string) => Promise<VaultMeta>
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('checking')
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [vaultSalt, setVaultSalt] = useState('')
  const [entries, setEntries] = useState<VaultEntry[]>([])
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
      s: VaultSettings,
      session: ServerSession | null,
      existingVault?: EncryptedVault | null,
    ) => {
      const { iv, ciphertext } = await encryptData(key, JSON.stringify(data))
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
      const data = JSON.parse(await decryptData(key, blob.iv, blob.ciphertext)) as VaultEntry[]
      setCryptoKey(key)
      setVaultSalt(blob.salt)
      setEntries(data)
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
      await persist(key, salt, [], s, session)
      setCryptoKey(key)
      setVaultSalt(salt)
      setEntries([])
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
      const data = JSON.parse(await decryptData(vaultKey, blob.iv, blob.ciphertext)) as VaultEntry[]
      setCryptoKey(vaultKey)
      setVaultSalt(blob.salt)
      setEntries(data)
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
      const { iv, ciphertext } = await encryptData(newKey, JSON.stringify(entries))
      const blob: EncryptedVault = { version: 1, salt: newSalt, iv, ciphertext }
      await saveVault(s.backend, s.vaultId, blob, remoteConfig(session))
      setCryptoKey(newKey)
      setVaultSalt(newSalt)
      setHasRecovery(false)
      setNeedsNewPassword(false)
    },
    [cryptoKey, entries],
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

  const importFromFile = useCallback(async () => {
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to import vault file.')
    }
  }, [])

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const addEntry = useCallback(
    async (entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!cryptoKey) return
      const newEntry: VaultEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const next = [...entries, newEntry]
      setEntries(next)
      const session = readSession()
      const blob = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
      await persist(cryptoKey, vaultSalt, next, settings, session, blob)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
  )

  const updateEntry = useCallback(
    async (id: string, patch: Partial<Omit<VaultEntry, 'id' | 'createdAt'>>) => {
      if (!cryptoKey) return
      const next = entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      )
      setEntries(next)
      const session = readSession()
      const blob = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
      await persist(cryptoKey, vaultSalt, next, settings, session, blob)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!cryptoKey) return
      const next = entries.filter((e) => e.id !== id)
      setEntries(next)
      const session = readSession()
      const blob = await loadVault(settings.backend, settings.vaultId, remoteConfig(session))
      await persist(cryptoKey, vaultSalt, next, settings, session, blob)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
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
        await persist(cryptoKey, vaultSalt, entries, updated, session, blob)
      }
    },
    [settings, cryptoKey, vaultSalt, entries, persist],
  )

  const clearError = useCallback(() => setError(null), [])

  // ─── Server session ────────────────────────────────────────────────────────

  const handleProbeServer = useCallback(async (url: string) => {
    return probeServer(url.trim().replace(/\/$/, ''))
  }, [])

  const requestOtp = useCallback(async (serverUrl: string, email: string) => {
    setError(null)
    setServerLoading(true)
    try {
      await requestServerOtp(serverUrl, email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login code')
      throw err
    } finally {
      setServerLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(async (serverUrl: string, email: string, otp: string) => {
    setError(null)
    setServerLoading(true)
    try {
      const { token, expiresAt } = await verifyServerOtp(serverUrl, email, otp)
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
        settings,
        error,
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
        deleteEntry,
        applySettings,
        clearError,
        serverSession,
        serverVaults,
        serverLoading,
        probeServer: handleProbeServer,
        requestOtp,
        verifyOtp,
        logoutServer,
        refreshServerVaults,
        createServerVault: handleCreateServerVault,
        inviteUser,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
