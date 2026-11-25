'use client'

/**
 * Vault state for the whole app. Two modes:
 *
 *  - local: a personal vault stored encrypted on this device (IndexedDB, or a
 *    file in the desktop app), unlocked with a master password.
 *  - org:   vaults on an org server. Nothing is stored on the device: the app
 *    reads and writes the server directly. Each user's private key unwraps the
 *    vault keys an admin shared with them (see lib/orgCrypto.ts).
 *
 * Both modes expose the same entries / collections / templates API, so the
 * dashboard doesn't care which one is open.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  EncryptedVault,
  VaultEntry,
  EntryDraft,
  Collection,
  CredentialTemplate,
  VaultData,
  VaultStatus,
} from '@roko/vault-core/lib/types'
import { decryptData, deriveKey, encryptData, randomSalt, wrapKey, unwrapKey } from '@roko/vault-core/lib/crypto'
import { loadVault, saveVault, exportVaultToFile, importVaultFromFile } from '@roko/vault-core/lib/storage'
import { generateMnemonic } from '@roko/vault-core/lib/mnemonic'
import { emptyVaultData, mergeVaultData, parseVaultData, serializeVaultData } from '@roko/vault-core/lib/templates'
import {
  deriveAccountSecrets,
  generateUserKeys,
  unlockPrivateKey,
  unwrapVaultKey,
  generateVaultKey,
  wrapVaultKey,
  encryptVaultV2,
  decryptVaultV2,
  type EncryptedVaultV2,
} from '@roko/vault-core/lib/orgCrypto'
import * as api from '@roko/vault-core/lib/orgApi'
import type { OrgMe, OrgSession, OrgVaultMeta } from '@roko/vault-core/lib/orgApi'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VaultMode = 'local' | 'org'

/**
 * Where an org user is:
 *  signed-out → (sign in) → choosing (keys unlocked, pick a vault) → open
 *  locked = a saved session exists but the private key needs the password again.
 */
export type OrgPhase = 'signed-out' | 'locked' | 'choosing' | 'open'

export type SyncState = 'idle' | 'saving' | 'error'

export interface OrgContext {
  phase: OrgPhase
  session: OrgSession | null
  me: OrgMe | null
  /** Unlocked private key (non-extractable). Only set in 'choosing' / 'open'. */
  privateKey: CryptoKey | null
  vaults: OrgVaultMeta[]
  activeVault: OrgVaultMeta | null
}

interface VaultContextValue {
  mode: VaultMode
  status: VaultStatus
  entries: VaultEntry[]
  collections: Collection[]
  templates: CredentialTemplate[]
  error: string | null
  clearError: () => void
  /** Viewing an org vault without edit permission. */
  readOnly: boolean
  /** Whether this vault may be downloaded. Always true for a personal vault. */
  canExport: boolean
  syncState: SyncState

  // ── Personal (local) vault ──────────────────────────────────────────────────
  needsNewPassword: boolean
  recoveryPhrase: string[] | null
  hasRecovery: boolean
  unlock: (password: string) => Promise<void>
  createVault: (password: string) => Promise<void>
  recoverWithPhrase: (words: string[]) => Promise<void>
  changeMasterPassword: (newPassword: string) => Promise<void>
  setupRecovery: () => Promise<void>
  clearRecoveryPhrase: () => void
  importFromFile: () => Promise<boolean>
  /** Download the vault as a file. Org vaults need a password for the file (and admin permission). */
  exportToFile: (filePassword?: string) => Promise<void>
  lock: () => void

  // ── Entries ─────────────────────────────────────────────────────────────────
  addEntry: (draft: EntryDraft, collectionId?: string | null) => Promise<void>
  updateEntry: (id: string, patch: Partial<EntryDraft>) => Promise<void>
  trashEntry: (id: string) => Promise<void>
  restoreEntry: (id: string) => Promise<void>
  deleteForever: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  moveEntryToCollection: (id: string, collectionId: string | null) => Promise<void>

  // ── Collections ─────────────────────────────────────────────────────────────
  addCollection: (name: string) => Promise<Collection>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  // ── Templates ───────────────────────────────────────────────────────────────
  saveTemplate: (t: CredentialTemplate) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  // ── Org ─────────────────────────────────────────────────────────────────────
  org: OrgContext
  switchMode: (mode: VaultMode) => void
  /** Step 1: check the server and password, the server emails a code. */
  orgSignIn: (serverUrl: string, email: string, password: string) => Promise<{ newAccount: boolean }>
  /** Step 2: verify the emailed code; sets up keys on first sign-in. */
  orgVerify: (otp: string) => Promise<void>
  /** Unlock keys for a saved session (after reload or lock). */
  orgUnlock: (password: string) => Promise<void>
  orgSignOut: () => Promise<void>
  refreshOrgVaults: () => Promise<OrgVaultMeta[]>
  openOrgVault: (id: string) => Promise<void>
  /** Back to the vault picker (keeps keys unlocked). */
  closeOrgVault: () => void
  /** Convert a legacy shared-password vault into an org vault. */
  convertLegacyVault: (id: string, vaultPassword: string) => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used inside <VaultProvider>')
  return ctx
}

// ─── Persistence of non-secret preferences ────────────────────────────────────

const MODE_KEY = 'roko-mode'
const ORG_SESSION_KEY = 'roko-org-session'
const ORG_SERVER_KEY = 'roko-org-server' // last server URL + email, to prefill the form
// Keys from before the org model; cleared on load.
const LEGACY_KEYS = ['roko-server-session', 'roko-settings']

function store<T>(key: string, value: T | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function lastOrgServer(): { serverUrl: string; email: string } | null {
  return read(ORG_SERVER_KEY)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface OpenOrgVault {
  meta: OrgVaultMeta
  key: CryptoKey
  revision: number
  /** Last state known to be on the server: the base for three-way merges. */
  base: VaultData
}

interface PendingSignIn {
  serverUrl: string
  email: string
  authHash: string
  privateKeyEncKey: CryptoKey
  legacyPassword?: string
}

const POLL_MS = 15_000

/**
 * `forceMode="org"` is for apps that only talk to an org server (the admin console):
 * it skips the personal-vault check and ignores the saved mode.
 */
export function VaultProvider({ children, forceMode }: { children: ReactNode; forceMode?: VaultMode }) {
  const [mode, setMode] = useState<VaultMode>('local')
  const [status, setStatus] = useState<VaultStatus>('checking')
  const [data, setDataState] = useState<VaultData>(emptyVaultData())
  const dataRef = useRef<VaultData>(emptyVaultData())
  const [error, setError] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')

  // Personal vault
  const [localKey, setLocalKey] = useState<CryptoKey | null>(null)
  const [localSalt, setLocalSalt] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState<string[] | null>(null)
  const [hasRecovery, setHasRecovery] = useState(false)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

  // Org
  const [org, setOrg] = useState<OrgContext>({
    phase: 'signed-out',
    session: null,
    me: null,
    privateKey: null,
    vaults: [],
    activeVault: null,
  })
  const orgRef = useRef(org)
  orgRef.current = org
  const openRef = useRef<OpenOrgVault | null>(null)
  const pendingSignIn = useRef<PendingSignIn | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const saving = useRef(0)

  const setData = useCallback((d: VaultData) => {
    dataRef.current = d
    setDataState(d)
  }, [])

  const resetData = useCallback(() => setData(emptyVaultData()), [setData])

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    for (const k of LEGACY_KEYS) store(k, null)
    const savedMode = forceMode ?? (read<VaultMode>(MODE_KEY) === 'org' ? 'org' : 'local')
    const session = read<OrgSession>(ORG_SESSION_KEY)
    if (savedMode === 'org' && session && session.expiresAt > Date.now()) {
      setMode('org')
      setOrg((o) => ({ ...o, phase: 'locked', session }))
      setStatus('locked')
      return
    }
    store(ORG_SESSION_KEY, null)
    if (savedMode === 'org') {
      setMode('org')
      setStatus('locked')
      return
    }
    loadVault()
      .then((v) => {
        setStatus(v ? 'locked' : 'empty')
        setHasRecovery(!!v?.recovery)
      })
      .catch(() => setStatus('empty'))
    // forceMode is fixed for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOrgError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof api.OrgApiError && err.status === 401) {
      // Session expired or account disabled: back to sign-in.
      store(ORG_SESSION_KEY, null)
      openRef.current = null
      setOrg({ phase: 'signed-out', session: null, me: null, privateKey: null, vaults: [], activeVault: null })
      setData(emptyVaultData())
      setStatus('locked')
      setError('Your session ended. Sign in again.')
      return
    }
    setError(err instanceof Error ? err.message : fallback)
  }, [setData])

  // ── Saving ──────────────────────────────────────────────────────────────────

  const saveLocal = useCallback(
    async (d: VaultData) => {
      if (!localKey) return
      const existing = await loadVault()
      const { iv, ciphertext } = await encryptData(localKey, serializeVaultData(d))
      const blob: EncryptedVault = {
        version: 1,
        salt: localSalt,
        iv,
        ciphertext,
        ...(existing?.recovery ? { recovery: existing.recovery } : {}),
      }
      await saveVault(blob)
    },
    [localKey, localSalt],
  )

  /** Push the latest local state to the server, merging if someone else saved first. */
  const saveOrg = useCallback(async () => {
    const open = openRef.current
    const session = orgRef.current.session
    if (!open || !session) return
    let attempts = 0
    while (attempts++ < 5) {
      const local = dataRef.current
      try {
        const blob = await encryptVaultV2(open.key, serializeVaultData(local))
        const { revision } = await api.putVault(session, open.meta.id, open.revision, blob)
        open.revision = revision
        open.base = local
        return
      } catch (err) {
        if (err instanceof api.OrgApiError && err.status === 409 && err.body.blob) {
          const remote = parseVaultData(await decryptVaultV2(open.key, err.body.blob as EncryptedVaultV2))
          const merged = mergeVaultData(open.base, dataRef.current, remote)
          open.revision = err.body.revision as number
          open.base = remote
          setData(merged)
          continue
        }
        throw err
      }
    }
    throw new Error('Could not save: the vault keeps changing. Try again in a moment.')
  }, [setData])

  /** Apply a change, update the UI immediately, then persist (queued, in order). */
  const commit = useCallback(
    async (change: (d: VaultData) => VaultData) => {
      if (mode === 'org' && openRef.current && !openRef.current.meta.canWrite) {
        throw new Error('You have read-only access to this vault.')
      }
      setData(change(dataRef.current))
      const run = async () => {
        saving.current++
        setSyncState('saving')
        try {
          if (mode === 'org') await saveOrg()
          else await saveLocal(dataRef.current)
          setSyncState('idle')
        } catch (err) {
          setSyncState('error')
          handleOrgError(err, 'Could not save your changes.')
        } finally {
          saving.current--
        }
      }
      const next = saveChain.current.then(run, run)
      saveChain.current = next
      await next
    },
    [mode, saveLocal, saveOrg, setData, handleOrgError],
  )

  // ── Polling for changes made by other org members ───────────────────────────
  useEffect(() => {
    if (mode !== 'org' || org.phase !== 'open') return
    let stopped = false
    const check = async () => {
      const open = openRef.current
      const session = orgRef.current.session
      if (!open || !session || saving.current > 0 || document.visibilityState !== 'visible') return
      try {
        const { revision } = await api.getRevision(session, open.meta.id)
        if (stopped || revision === open.revision) return
        const res = await api.getVault(session, open.meta.id)
        if (stopped || !res.blob || saving.current > 0) return
        const remote = parseVaultData(await decryptVaultV2(open.key, res.blob as EncryptedVaultV2))
        const merged = mergeVaultData(open.base, dataRef.current, remote)
        open.revision = res.revision
        open.base = remote
        setData(merged)
      } catch (err) {
        if (err instanceof api.OrgApiError && (err.status === 401 || err.status === 404 || err.status === 403)) {
          handleOrgError(
            err.status === 401 ? err : new Error('Your access to this vault was removed by an admin.'),
            'Lost access to this vault.',
          )
          if (err.status !== 401) {
            openRef.current = null
            setData(emptyVaultData())
            setOrg((o) => ({ ...o, phase: 'choosing', activeVault: null }))
            setStatus('locked')
          }
        }
        // Network blips: try again on the next tick.
      }
    }
    const t = setInterval(check, POLL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => {
      stopped = true
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [mode, org.phase, setData, handleOrgError])

  // ── Personal vault: auth ────────────────────────────────────────────────────

  const unlock = useCallback(
    async (password: string) => {
      setError(null)
      try {
        const blob = await loadVault()
        if (!blob) {
          setStatus('empty')
          setError('No vault found. Create one first.')
          return
        }
        const key = await deriveKey(password, blob.salt)
        const d = parseVaultData(await decryptData(key, blob.iv, blob.ciphertext))
        setLocalKey(key)
        setLocalSalt(blob.salt)
        setData(d)
        setHasRecovery(!!blob.recovery)
        setStatus('unlocked')
      } catch {
        setError('Incorrect master password or corrupted vault.')
      }
    },
    [setData],
  )

  const createVault = useCallback(
    async (password: string) => {
      setError(null)
      const salt = randomSalt()
      const key = await deriveKey(password, salt)
      const { iv, ciphertext } = await encryptData(key, serializeVaultData(emptyVaultData()))
      await saveVault({ version: 1, salt, iv, ciphertext })
      setLocalKey(key)
      setLocalSalt(salt)
      resetData()
      setHasRecovery(false)
      setStatus('unlocked')
    },
    [resetData],
  )

  const recoverWithPhrase = useCallback(
    async (words: string[]) => {
      setError(null)
      try {
        const blob = await loadVault()
        if (!blob?.recovery) throw new Error('This vault has no recovery phrase set up.')
        const recoveryKey = await deriveKey(words.join(' '), blob.recovery.salt)
        const vaultKey = await unwrapKey(blob.recovery.wrappedKey, blob.recovery.iv, recoveryKey)
        const d = parseVaultData(await decryptData(vaultKey, blob.iv, blob.ciphertext))
        setLocalKey(vaultKey)
        setLocalSalt(blob.salt)
        setData(d)
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
    },
    [setData],
  )

  const changeMasterPassword = useCallback(
    async (newPassword: string) => {
      if (!localKey) return
      const newSalt = randomSalt()
      const newKey = await deriveKey(newPassword, newSalt)
      const { iv, ciphertext } = await encryptData(newKey, serializeVaultData(dataRef.current))
      await saveVault({ version: 1, salt: newSalt, iv, ciphertext })
      setLocalKey(newKey)
      setLocalSalt(newSalt)
      setHasRecovery(false)
      setNeedsNewPassword(false)
    },
    [localKey],
  )

  const setupRecovery = useCallback(async () => {
    if (!localKey) return
    const blob = await loadVault()
    if (!blob) return
    const words = generateMnemonic()
    const recoverySalt = randomSalt()
    const recoveryKey = await deriveKey(words.join(' '), recoverySalt)
    const { iv, wrappedKey } = await wrapKey(localKey, recoveryKey)
    await saveVault({ ...blob, recovery: { salt: recoverySalt, iv, wrappedKey } })
    setHasRecovery(true)
    setRecoveryPhrase(words)
  }, [localKey])

  const clearRecoveryPhrase = useCallback(() => setRecoveryPhrase(null), [])

  const importFromFile = useCallback(async (): Promise<boolean> => {
    try {
      const blob = await importVaultFromFile()
      if (blob.version !== 1) throw new Error('Unsupported vault file.')
      await saveVault(blob)
      setLocalKey(null)
      setLocalSalt('')
      resetData()
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
  }, [resetData])

  const exportToFile = useCallback(
    async (filePassword?: string) => {
      if (mode === 'local') {
        const blob = await loadVault()
        if (blob) await exportVaultToFile(blob)
        return
      }
      const open = openRef.current
      const session = orgRef.current.session
      if (!open || !session) return
      if (!filePassword || filePassword.length < 8) throw new Error('Choose a file password of at least 8 characters.')
      // The server checks (and audits) the admin's download permission first.
      await api.requestExport(session, open.meta.id)
      // The file is a standalone personal vault, protected by the file password.
      const salt = randomSalt()
      const key = await deriveKey(filePassword, salt)
      const { iv, ciphertext } = await encryptData(key, serializeVaultData(dataRef.current))
      await exportVaultToFile({ version: 1, salt, iv, ciphertext })
    },
    [mode],
  )

  const lock = useCallback(() => {
    resetData()
    setError(null)
    setRecoveryPhrase(null)
    setNeedsNewPassword(false)
    if (mode === 'org') {
      // Forget every key; the saved session needs the password again.
      openRef.current = null
      setOrg((o) => ({ ...o, phase: o.session ? 'locked' : 'signed-out', privateKey: null, vaults: [], activeVault: null }))
    } else {
      setLocalKey(null)
      setLocalSalt('')
    }
    setStatus('locked')
  }, [mode, resetData])

  // ── Entries ─────────────────────────────────────────────────────────────────

  const mapEntries = (f: (e: VaultEntry) => VaultEntry) => (d: VaultData) => ({ ...d, entries: d.entries.map(f) })

  const addEntry = useCallback(
    async (draft: EntryDraft, collectionId: string | null = null) => {
      const now = Date.now()
      const entry: VaultEntry = {
        ...draft,
        id: crypto.randomUUID(),
        favorite: false,
        collectionId,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      await commit((d) => ({ ...d, entries: [...d.entries, entry] }))
    },
    [commit],
  )

  const updateEntry = useCallback(
    (id: string, patch: Partial<EntryDraft>) =>
      commit(mapEntries((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e))),
    [commit],
  )
  const trashEntry = useCallback(
    (id: string) =>
      commit(mapEntries((e) => (e.id === id ? { ...e, deletedAt: Date.now(), favorite: false, updatedAt: Date.now() } : e))),
    [commit],
  )
  const restoreEntry = useCallback(
    (id: string) => commit(mapEntries((e) => (e.id === id ? { ...e, deletedAt: null, updatedAt: Date.now() } : e))),
    [commit],
  )
  const deleteForever = useCallback(
    (id: string) => commit((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) })),
    [commit],
  )
  const toggleFavorite = useCallback(
    (id: string) => commit(mapEntries((e) => (e.id === id ? { ...e, favorite: !e.favorite, updatedAt: Date.now() } : e))),
    [commit],
  )
  const moveEntryToCollection = useCallback(
    (id: string, collectionId: string | null) =>
      commit(mapEntries((e) => (e.id === id ? { ...e, collectionId, updatedAt: Date.now() } : e))),
    [commit],
  )

  // ── Collections ─────────────────────────────────────────────────────────────

  const addCollection = useCallback(
    async (name: string): Promise<Collection> => {
      const col: Collection = { id: crypto.randomUUID(), name: name.trim() || 'Untitled', createdAt: Date.now() }
      await commit((d) => ({ ...d, collections: [...d.collections, col] }))
      return col
    },
    [commit],
  )
  const renameCollection = useCallback(
    (id: string, name: string) =>
      commit((d) => ({ ...d, collections: d.collections.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)) })),
    [commit],
  )
  const deleteCollection = useCallback(
    (id: string) =>
      commit((d) => ({
        ...d,
        entries: d.entries.map((e) => (e.collectionId === id ? { ...e, collectionId: null, updatedAt: Date.now() } : e)),
        collections: d.collections.filter((c) => c.id !== id),
      })),
    [commit],
  )

  // ── Templates ───────────────────────────────────────────────────────────────

  const saveTemplate = useCallback(
    (t: CredentialTemplate) =>
      commit((d) => {
        const stamped = { ...t, updatedAt: Date.now() }
        const exists = d.templates.some((x) => x.id === t.id)
        return { ...d, templates: exists ? d.templates.map((x) => (x.id === t.id ? stamped : x)) : [...d.templates, stamped] }
      }),
    [commit],
  )
  const deleteTemplate = useCallback(
    async (id: string) => {
      const inUse = dataRef.current.entries.filter((e) => e.templateId === id).length
      if (inUse) throw new Error(`${inUse} item${inUse === 1 ? ' uses' : 's use'} this template. Delete or move those first.`)
      await commit((d) => ({ ...d, templates: d.templates.filter((x) => x.id !== id) }))
    },
    [commit],
  )

  // ── Org: sign in / unlock ───────────────────────────────────────────────────

  const switchMode = useCallback(
    (next: VaultMode) => {
      setError(null)
      resetData()
      openRef.current = null
      setMode(next)
      store(MODE_KEY, next)
      if (next === 'local') {
        setStatus('checking')
        loadVault()
          .then((v) => {
            setStatus(v ? 'locked' : 'empty')
            setHasRecovery(!!v?.recovery)
          })
          .catch(() => setStatus('empty'))
      } else {
        setLocalKey(null)
        const session = read<OrgSession>(ORG_SESSION_KEY)
        const valid = session && session.expiresAt > Date.now()
        setOrg({ phase: valid ? 'locked' : 'signed-out', session: valid ? session : null, me: null, privateKey: null, vaults: [], activeVault: null })
        setStatus('locked')
      }
    },
    [resetData],
  )

  const orgSignIn = useCallback(async (serverUrlRaw: string, emailRaw: string, password: string) => {
    setError(null)
    const serverUrl = api.normalizeServerUrl(serverUrlRaw)
    const email = emailRaw.trim().toLowerCase()
    await api.probeServer(serverUrl)
    const { authHash, privateKeyEncKey } = await deriveAccountSecrets(email, password)
    let legacyPassword: string | undefined
    let res: { newAccount: boolean }
    try {
      res = await api.login(serverUrl, { email, authHash })
    } catch (err) {
      if (err instanceof api.OrgApiError && err.code === 'legacy_password') {
        // Account created before client-side hashing: prove the old password once,
        // after which the server only ever stores the new auth hash.
        legacyPassword = password
        res = await api.login(serverUrl, { email, authHash, legacyPassword })
      } else throw err
    }
    pendingSignIn.current = { serverUrl, email, authHash, privateKeyEncKey, legacyPassword }
    store(ORG_SERVER_KEY, { serverUrl, email })
    return { newAccount: res.newAccount }
  }, [])

  const finishOrgUnlock = useCallback(async (session: OrgSession, privateKeyEncKey: CryptoKey) => {
    let me = await api.me(session)
    let privateKey: CryptoKey
    if (!me.publicKey || !me.encryptedPrivateKey) {
      // First sign-in: create this user's key pair.
      const keys = await generateUserKeys(privateKeyEncKey)
      await api.putKeys(session, keys.publicKey, keys.encryptedPrivateKey)
      privateKey = keys.privateKey
      me = await api.me(session)
    } else {
      try {
        privateKey = await unlockPrivateKey(privateKeyEncKey, me.encryptedPrivateKey)
      } catch {
        throw new Error('Incorrect password.')
      }
    }
    const vaults = await api.listVaults(session)
    setOrg({ phase: 'choosing', session, me, privateKey, vaults, activeVault: null })
    setStatus('locked')
  }, [])

  const orgVerify = useCallback(
    async (otp: string) => {
      setError(null)
      const p = pendingSignIn.current
      if (!p) throw new Error('Start signing in again.')
      const { token, expiresAt } = await api.verify(p.serverUrl, {
        email: p.email,
        authHash: p.authHash,
        legacyPassword: p.legacyPassword,
        otp: otp.trim(),
      })
      const session: OrgSession = { serverUrl: p.serverUrl, token, expiresAt, userId: '', email: p.email }
      const me = await api.me(session)
      session.userId = me.id
      store(ORG_SESSION_KEY, session)
      store(MODE_KEY, 'org')
      setMode('org')
      pendingSignIn.current = null
      await finishOrgUnlock(session, p.privateKeyEncKey)
    },
    [finishOrgUnlock],
  )

  const orgUnlock = useCallback(
    async (password: string) => {
      setError(null)
      const session = orgRef.current.session
      if (!session) throw new Error('Sign in first.')
      const { privateKeyEncKey } = await deriveAccountSecrets(session.email, password)
      try {
        await finishOrgUnlock(session, privateKeyEncKey)
      } catch (err) {
        if (err instanceof api.OrgApiError && err.status === 401) {
          handleOrgError(err, 'Session ended.')
          return
        }
        throw err
      }
    },
    [finishOrgUnlock, handleOrgError],
  )

  const orgSignOut = useCallback(async () => {
    const session = orgRef.current.session
    if (session) await api.logout(session).catch(() => {})
    store(ORG_SESSION_KEY, null)
    openRef.current = null
    resetData()
    setOrg({ phase: 'signed-out', session: null, me: null, privateKey: null, vaults: [], activeVault: null })
    setStatus('locked')
  }, [resetData])

  // ── Org: vaults ─────────────────────────────────────────────────────────────

  const refreshOrgVaults = useCallback(async () => {
    const session = orgRef.current.session
    if (!session) return []
    try {
      const vaults = await api.listVaults(session)
      setOrg((o) => ({
        ...o,
        vaults,
        activeVault: o.activeVault ? vaults.find((v) => v.id === o.activeVault!.id) ?? null : null,
      }))
      if (openRef.current) {
        const fresh = vaults.find((v) => v.id === openRef.current!.meta.id)
        if (fresh) openRef.current.meta = fresh
      }
      return vaults
    } catch (err) {
      handleOrgError(err, 'Could not load vaults.')
      return []
    }
  }, [handleOrgError])

  const openOrgVault = useCallback(
    async (id: string) => {
      setError(null)
      const { session, privateKey } = orgRef.current
      if (!session || !privateKey) throw new Error('Unlock first.')
      const vaults = await api.listVaults(session)
      const meta = vaults.find((v) => v.id === id)
      if (!meta) throw new Error('You no longer have access to this vault.')
      if (meta.kind === 'legacy') throw new Error('This is a legacy vault. Convert it first.')
      if (meta.pending || !meta.wrappedKey) throw new Error('An admin still needs to finish sharing this vault with you.')
      const key = await unwrapVaultKey(meta.wrappedKey, privateKey)
      const res = await api.getVault(session, id)
      const d = res.blob ? parseVaultData(await decryptVaultV2(key, res.blob as EncryptedVaultV2)) : emptyVaultData()
      openRef.current = { meta, key, revision: res.revision, base: d }
      setData(d)
      setOrg((o) => ({ ...o, vaults, phase: 'open', activeVault: meta }))
      setStatus('unlocked')
    },
    [setData],
  )

  const closeOrgVault = useCallback(() => {
    openRef.current = null
    resetData()
    setOrg((o) => ({ ...o, phase: o.privateKey ? 'choosing' : 'locked', activeVault: null }))
    setStatus('locked')
    void refreshOrgVaults()
  }, [resetData, refreshOrgVaults])

  const convertLegacyVault = useCallback(
    async (id: string, vaultPassword: string) => {
      const { session } = orgRef.current
      if (!session) throw new Error('Sign in first.')
      const res = await api.getVault(session, id)
      const blob = res.blob as EncryptedVault | null
      let d: VaultData
      if (!blob || blob.version !== 1) {
        d = emptyVaultData()
      } else {
        try {
          const key = await deriveKey(vaultPassword, blob.salt)
          d = parseVaultData(await decryptData(key, blob.iv, blob.ciphertext))
        } catch {
          throw new Error('That vault password is incorrect.')
        }
      }
      const vaultKey = await generateVaultKey()
      const targets = await api.keyTargets(session, id)
      const wrappedKeys: Record<string, string> = {}
      for (const t of targets) if (t.publicKey) wrappedKeys[t.userId] = await wrapVaultKey(vaultKey, t.publicKey)
      await api.convertLegacyVault(session, id, await encryptVaultV2(vaultKey, serializeVaultData(d)), wrappedKeys)
      await refreshOrgVaults()
      await openOrgVault(id)
    },
    [refreshOrgVaults, openOrgVault],
  )

  // ── Context value ───────────────────────────────────────────────────────────

  const active = org.activeVault
  const readOnly = mode === 'org' && !!active && !active.canWrite
  const canExport = mode === 'local' || (!!active && active.canExport)

  return (
    <VaultContext.Provider
      value={{
        mode,
        status,
        entries: data.entries,
        collections: data.collections,
        templates: data.templates,
        error,
        clearError: () => setError(null),
        readOnly,
        canExport,
        syncState,
        needsNewPassword,
        recoveryPhrase,
        hasRecovery,
        unlock,
        createVault,
        recoverWithPhrase,
        changeMasterPassword,
        setupRecovery,
        clearRecoveryPhrase,
        importFromFile,
        exportToFile,
        lock,
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
        saveTemplate,
        deleteTemplate,
        org,
        switchMode,
        orgSignIn,
        orgVerify,
        orgUnlock,
        orgSignOut,
        refreshOrgVaults,
        openOrgVault,
        closeOrgVault,
        convertLegacyVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
