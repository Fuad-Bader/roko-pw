'use client'

import { useState, useMemo, useCallback, type FormEvent } from 'react'
import type { VaultEntry } from '@/lib/types'
import { useVault } from './VaultProvider'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { PasswordGenerator } from './PasswordGenerator'
import { RecoveryPhraseDisplay } from './RecoveryPhraseDisplay'

type Panel = 'none' | 'add' | 'edit' | 'settings' | 'generator'

export function VaultDashboard() {
  const {
    entries,
    lock,
    addEntry,
    updateEntry,
    deleteEntry,
    settings,
    applySettings,
    exportToFile,
    setupRecovery,
    clearRecoveryPhrase,
    recoveryPhrase,
    hasRecovery,
    needsNewPassword,
    changeMasterPassword,
    error,
    clearError,
  } = useVault()
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>('none')
  const [editing, setEditing] = useState<VaultEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q),
    )
  }, [entries, query])

  const openEdit = useCallback((entry: VaultEntry) => {
    setEditing(entry)
    setPanel('edit')
  }, [])

  const closePanel = useCallback(() => {
    setPanel('none')
    setEditing(null)
  }, [])

  const handleAdd = async (data: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addEntry(data)
    closePanel()
  }

  const handleUpdate = async (data: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editing) return
    await updateEntry(editing.id, data)
    closePanel()
  }

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      await deleteEntry(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <span className="text-xl">🔐</span>
          <span className="font-bold tracking-tight">
            Roko
            <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              PW
            </span>
          </span>

          {/* Search */}
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search credentials…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              🔍
            </span>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'generator' ? 'none' : 'generator'))}
            title="Password generator"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ✨
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'add' ? 'none' : 'add'))}
            title="Add credential"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
          >
            + Add
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
            title="Settings"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={lock}
            title="Lock vault"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
          >
            🔒
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {/* ── Slide-in panels ── */}
        {panel === 'add' && (
          <SlidePanel title="Add credential" onClose={closePanel}>
            <CredentialForm onSave={handleAdd} onCancel={closePanel} />
          </SlidePanel>
        )}

        {panel === 'edit' && editing && (
          <SlidePanel title="Edit credential" onClose={closePanel}>
            <CredentialForm initial={editing} onSave={handleUpdate} onCancel={closePanel} />
          </SlidePanel>
        )}

        {panel === 'generator' && (
          <SlidePanel title="Password generator" onClose={closePanel}>
            <PasswordGenerator />
          </SlidePanel>
        )}

        {panel === 'settings' && (
          <SlidePanel title="Settings" onClose={closePanel}>
            <SettingsPanel
              settings={settings}
              onApply={applySettings}
              onExport={exportToFile}
              onSetupRecovery={setupRecovery}
              hasRecovery={hasRecovery}
              error={error}
              clearError={clearError}
            />
          </SlidePanel>
        )}

        {/* ── Credential list ── */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState hasEntries={entries.length > 0} onAdd={() => setPanel('add')} />
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="relative">
                <CredentialCard entry={entry} onEdit={openEdit} onDelete={handleDelete} />
                {deleteConfirm === entry.id && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-red-950/90">
                    <p className="text-sm text-red-300">
                      Click delete again to confirm removal
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {entries.length > 0 && (
          <p className="mt-6 text-center text-xs text-zinc-600">
            {entries.length} credential{entries.length !== 1 ? 's' : ''} · encrypted with AES-256-GCM
          </p>
        )}
      </main>

      {/* ── Recovery phrase display modal ── */}
      {recoveryPhrase && (
        <Modal>
          <RecoveryPhraseDisplay words={recoveryPhrase} onConfirmed={clearRecoveryPhrase} />
        </Modal>
      )}

      {/* ── Set new password modal (after phrase recovery) ── */}
      {needsNewPassword && !recoveryPhrase && (
        <Modal>
          <SetNewPasswordForm onSave={changeMasterPassword} />
        </Modal>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SlidePanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

function SetNewPasswordForm({ onSave }: { onSave: (pw: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await onSave(password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-white">Set a new master password</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Your vault has been recovered. Create a new master password to protect it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="new-pw">
            New master password
          </label>
          <input
            id="new-pw"
            type="password"
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="new-pw-confirm">
            Confirm password
          </label>
          <input
            id="new-pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {localError && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{localError}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}

function EmptyState({ hasEntries, onAdd }: { hasEntries: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="text-5xl">🔑</span>
      <p className="text-lg font-semibold text-white">
        {hasEntries ? 'No results found' : 'Your vault is empty'}
      </p>
      {!hasEntries && (
        <>
          <p className="text-sm text-zinc-500">Add your first credential to get started.</p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            Add credential
          </button>
        </>
      )}
    </div>
  )
}

function SettingsPanel({
  settings,
  onApply,
  onExport,
  onSetupRecovery,
  hasRecovery,
  error,
  clearError,
}: {
  settings: ReturnType<typeof useVault>['settings']
  onApply: ReturnType<typeof useVault>['applySettings']
  onExport: () => Promise<void>
  onSetupRecovery: () => Promise<void>
  hasRecovery: boolean
  error: string | null
  clearError: () => void
}) {
  const [vaultIdInput, setVaultIdInput] = useState(settings.vaultId)
  const [saved, setSaved] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)

  const save = async () => {
    await onApply({ backend: settings.backend, vaultId: vaultIdInput })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      await onExport()
    } finally {
      setExportLoading(false)
    }
  }

  const handleSetupRecovery = async () => {
    clearError()
    setRecoveryLoading(true)
    try {
      await onSetupRecovery()
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Storage backend */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-400">Storage backend</p>
        <div className="flex gap-2">
          {(['local', 'remote'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onApply({ backend: b })}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                settings.backend === b
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {b === 'local' ? '💾 Local (IndexedDB)' : '☁️ Remote server'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-600">
          {settings.backend === 'local'
            ? 'Vault is stored in this browser only.'
            : 'Encrypted vault blob is synced to the Next.js API route. The server never sees your passwords.'}
        </p>
      </div>

      {/* Vault ID */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="vaultId">
          Vault ID{' '}
          <span className="text-zinc-600">(share this to sync across devices)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="vaultId"
            value={vaultIdInput}
            onChange={(e) => setVaultIdInput(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600"
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Export vault to file */}
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-400">Portable backup</p>
        <p className="mb-2 text-xs text-zinc-600">
          Save a copy of your encrypted vault as a <span className="font-mono">.rkpw</span> file.
          You can store it on a USB drive and open it on any device.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportLoading}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {exportLoading ? 'Saving…' : '💾 Export vault to file'}
        </button>
      </div>

      {/* Recovery phrase */}
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-400">Recovery phrase</p>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              hasRecovery
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {hasRecovery ? '✓ Recovery enabled' : '⚠ No recovery set up'}
          </span>
        </div>
        <p className="mb-2 text-xs text-zinc-600">
          {hasRecovery
            ? 'Your vault can be recovered using your 12-word phrase. Generate a new one to rotate it.'
            : 'Without a recovery phrase, a forgotten master password means permanent loss of access.'}
        </p>
        <button
          type="button"
          onClick={handleSetupRecovery}
          disabled={recoveryLoading}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {recoveryLoading
            ? 'Generating…'
            : hasRecovery
              ? '🔄 Rotate recovery phrase'
              : '🛡 Set up recovery phrase'}
        </button>
        {error && (
          <p className="mt-2 rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{error}</p>
        )}
      </div>

      <p className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-500">
        🔒 Your vault data is encrypted with AES-256-GCM before leaving your device.
        The master password is never stored or transmitted.
      </p>
    </div>
  )
}
