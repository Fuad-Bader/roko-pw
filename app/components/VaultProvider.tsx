'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { EncryptedVault, VaultEntry, VaultSettings, VaultStatus } from '@/lib/types'
import {
  decryptData,
  deriveKey,
  encryptData,
  randomSalt,
  wrapKey,
  unwrapKey,
} from '@/lib/crypto'
import { loadVault, saveVault, exportVaultToFile, importVaultFromFile } from '@/lib/storage'
import { generateMnemonic } from '@/lib/mnemonic'

// ─── Context shape ────────────────────────────────────────────────────────────

interface VaultContextValue {
  status: VaultStatus
  entries: VaultEntry[]
  settings: VaultSettings
  error: string | null

  /** True when the vault was just unlocked via recovery phrase — user must set new password. */
  needsNewPassword: boolean
  /** Non-null immediately after setupRecovery() until clearRecoveryPhrase() is called. */
  recoveryPhrase: string[] | null

  // ── Auth ──────────────────────────────────────────────────────────────────
  unlock: (password: string) => Promise<void>
  lock: () => void
  createVault: (password: string) => Promise<void>
  recoverWithPhrase: (words: string[]) => Promise<void>
  /** Re-encrypt the vault under a new master password. Clears existing recovery setup. */
  changeMasterPassword: (newPassword: string) => Promise<void>

  // ── Recovery ──────────────────────────────────────────────────────────────
  /** Generate a recovery phrase and wrap the current vault key with it. */
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
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}

// ─── localStorage settings helpers ───────────────────────────────────────────

const SETTINGS_KEY = 'roko-settings'

function readSettings(): VaultSettings {
  if (typeof window === 'undefined') return { backend: 'local', vaultId: '' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw) as VaultSettings
  } catch { /* corrupted */ }
  const fresh: VaultSettings = { backend: 'local', vaultId: crypto.randomUUID() }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(fresh))
  return fresh
}

function writeSettings(s: VaultSettings) {
  if (typeof window !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('checking')
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [vaultSalt, setVaultSalt] = useState('')
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [settings, setSettings] = useState<VaultSettings>({ backend: 'local', vaultId: '' })
  const [error, setError] = useState<string | null>(null)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[] | null>(null)
  const [hasRecovery, setHasRecovery] = useState(false)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

  // Probe for existing vault on mount
  useEffect(() => {
    const s = readSettings()
    setSettings(s)
    loadVault(s.backend, s.vaultId)
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
      existingVault?: EncryptedVault | null,
    ) => {
      const { iv, ciphertext } = await encryptData(key, JSON.stringify(data))
      const blob: EncryptedVault = {
        version: 1,
        salt,
        iv,
        ciphertext,
        // Carry forward existing recovery data unless explicitly cleared
        ...(existingVault?.recovery ? { recovery: existingVault.recovery } : {}),
      }
      await saveVault(s.backend, s.vaultId, blob)
      return blob
    },
    [],
  )

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const unlock = useCallback(async (password: string) => {
    setError(null)
    const s = readSettings()
    setSettings(s)
    try {
      const blob = await loadVault(s.backend, s.vaultId)
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
      const salt = randomSalt()
      const key = await deriveKey(password, salt)
      await persist(key, salt, [], s)
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
    try {
      const blob = await loadVault(s.backend, s.vaultId)
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
      const newSalt = randomSalt()
      const newKey = await deriveKey(newPassword, newSalt)
      // Re-encrypt entries with the new key; recovery is cleared (user can re-setup)
      const { iv, ciphertext } = await encryptData(newKey, JSON.stringify(entries))
      const blob: EncryptedVault = { version: 1, salt: newSalt, iv, ciphertext }
      await saveVault(s.backend, s.vaultId, blob)
      setCryptoKey(newKey)
      setVaultSalt(newSalt)
      setHasRecovery(false)
      setNeedsNewPassword(false)
    },
    [cryptoKey, entries, settings],
  )

  // ─── Recovery setup ────────────────────────────────────────────────────────

  const setupRecovery = useCallback(async () => {
    if (!cryptoKey) return
    const s = readSettings()
    const blob = await loadVault(s.backend, s.vaultId)
    if (!blob) return

    const words = generateMnemonic()
    const recoverySalt = randomSalt()
    const recoveryKey = await deriveKey(words.join(' '), recoverySalt)
    const { iv, wrappedKey } = await wrapKey(cryptoKey, recoveryKey)

    const updated: EncryptedVault = {
      ...blob,
      recovery: { salt: recoverySalt, iv, wrappedKey },
    }
    await saveVault(s.backend, s.vaultId, updated)
    setHasRecovery(true)
    setRecoveryPhrase(words)
  }, [cryptoKey, settings])

  const clearRecoveryPhrase = useCallback(() => setRecoveryPhrase(null), [])

  // ─── File I/O ──────────────────────────────────────────────────────────────

  const exportToFile = useCallback(async () => {
    const s = readSettings()
    const blob = await loadVault(s.backend, s.vaultId)
    if (blob) await exportVaultToFile(blob)
  }, [])

  const importFromFile = useCallback(async () => {
    try {
      const blob = await importVaultFromFile()
      if (blob.version !== 1) throw new Error('Unsupported vault version.')
      // Always persist locally after import
      const s = readSettings()
      await saveVault('local', s.vaultId, blob)
      const updated = { ...s, backend: 'local' as const }
      writeSettings(updated)
      setSettings(updated)
      // Reset to locked — user must unlock with their password
      setCryptoKey(null)
      setVaultSalt('')
      setEntries([])
      setHasRecovery(!!blob.recovery)
      setNeedsNewPassword(false)
      setError(null)
      setStatus('locked')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return // user cancelled
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
      const blob = await loadVault(settings.backend, settings.vaultId)
      await persist(cryptoKey, vaultSalt, next, settings, blob)
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
      const blob = await loadVault(settings.backend, settings.vaultId)
      await persist(cryptoKey, vaultSalt, next, settings, blob)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!cryptoKey) return
      const next = entries.filter((e) => e.id !== id)
      setEntries(next)
      const blob = await loadVault(settings.backend, settings.vaultId)
      await persist(cryptoKey, vaultSalt, next, settings, blob)
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
        const blob = await loadVault(settings.backend, settings.vaultId)
        await persist(cryptoKey, vaultSalt, entries, updated, blob)
      }
    },
    [settings, cryptoKey, vaultSalt, entries, persist],
  )

  const clearError = useCallback(() => setError(null), [])

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
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
