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
import { decryptData, deriveKey, encryptData, randomSalt } from '@/lib/crypto'
import { loadVault, saveVault } from '@/lib/storage'

// ─── Context shape ────────────────────────────────────────────────────────────

interface VaultContextValue {
  status: VaultStatus
  entries: VaultEntry[]
  settings: VaultSettings
  error: string | null

  /** Unlock an existing vault with the master password. */
  unlock: (password: string) => Promise<void>
  /** Lock the vault and wipe all in-memory keys / plaintext. */
  lock: () => void
  /** Create a brand-new vault protected by the given master password. */
  createVault: (password: string) => Promise<void>
  addEntry: (entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateEntry: (id: string, patch: Partial<Omit<VaultEntry, 'id' | 'createdAt'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  /** Persist a settings change and update context. */
  applySettings: (patch: Partial<VaultSettings>) => Promise<void>
  clearError: () => void
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}

// ─── Settings helpers (localStorage) ─────────────────────────────────────────

const SETTINGS_KEY = 'roko-settings'

function readSettings(): VaultSettings {
  if (typeof window === 'undefined') return { backend: 'local', vaultId: '' }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw) as VaultSettings
  } catch {
    // corrupted – fall through
  }
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

  // Load settings from localStorage and probe for an existing vault on mount.
  useEffect(() => {
    const s = readSettings()
    setSettings(s)
    loadVault(s.backend, s.vaultId)
      .then((v) => setStatus(v ? 'locked' : 'empty'))
      .catch(() => setStatus('empty'))
  }, [])

  // ─── Persist helper ─────────────────────────────────────────────────────────

  const persist = useCallback(
    async (key: CryptoKey, salt: string, data: VaultEntry[], s: VaultSettings) => {
      const { iv, ciphertext } = await encryptData(key, JSON.stringify(data))
      const blob: EncryptedVault = { version: 1, salt, iv, ciphertext }
      await saveVault(s.backend, s.vaultId, blob)
    },
    [],
  )

  // ─── Vault operations ────────────────────────────────────────────────────────

  const unlock = useCallback(
    async (password: string) => {
      setError(null)
      const s = readSettings()
      setSettings(s)
      try {
        const blob = await loadVault(s.backend, s.vaultId)
        if (!blob) {
          setStatus('empty')
          setError('No vault found. Create a new vault first.')
          return
        }
        const key = await deriveKey(password, blob.salt)
        const plaintext = await decryptData(key, blob.iv, blob.ciphertext)
        const data = JSON.parse(plaintext) as VaultEntry[]
        setCryptoKey(key)
        setVaultSalt(blob.salt)
        setEntries(data)
        setStatus('unlocked')
      } catch {
        setError('Incorrect master password or corrupted vault.')
      }
    },
    [],
  )

  const lock = useCallback(() => {
    setCryptoKey(null)
    setVaultSalt('')
    setEntries([])
    setError(null)
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
      setStatus('unlocked')
    },
    [persist],
  )

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
      await persist(cryptoKey, vaultSalt, next, settings)
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
      await persist(cryptoKey, vaultSalt, next, settings)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!cryptoKey) return
      const next = entries.filter((e) => e.id !== id)
      setEntries(next)
      await persist(cryptoKey, vaultSalt, next, settings)
    },
    [cryptoKey, entries, vaultSalt, settings, persist],
  )

  const applySettings = useCallback(
    async (patch: Partial<VaultSettings>) => {
      const updated = { ...settings, ...patch }
      writeSettings(updated)
      setSettings(updated)
      // If vault is unlocked, migrate the encrypted blob to the new backend.
      if (cryptoKey && vaultSalt) {
        await persist(cryptoKey, vaultSalt, entries, updated)
      }
    },
    [settings, cryptoKey, vaultSalt, entries, persist],
  )

  const clearError = useCallback(() => setError(null), [])

  const value: VaultContextValue = {
    status,
    entries,
    settings,
    error,
    unlock,
    lock,
    createVault,
    addEntry,
    updateEntry,
    deleteEntry,
    applySettings,
    clearError,
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}
