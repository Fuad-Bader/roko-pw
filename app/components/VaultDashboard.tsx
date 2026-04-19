'use client'

import { useState, useMemo, useCallback } from 'react'
import type { VaultEntry } from '@/lib/types'
import { useVault } from './VaultProvider'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { PasswordGenerator } from './PasswordGenerator'

type Panel = 'none' | 'add' | 'edit' | 'settings' | 'generator'

export function VaultDashboard() {
  const { entries, lock, addEntry, updateEntry, deleteEntry, settings, applySettings } = useVault()
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
          <span className="font-bold tracking-tight">Roko</span>

          {/* Search */}
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search credentials…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
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
          <Panel title="Add credential" onClose={closePanel}>
            <CredentialForm onSave={handleAdd} onCancel={closePanel} />
          </Panel>
        )}

        {panel === 'edit' && editing && (
          <Panel title="Edit credential" onClose={closePanel}>
            <CredentialForm initial={editing} onSave={handleUpdate} onCancel={closePanel} />
          </Panel>
        )}

        {panel === 'generator' && (
          <Panel title="Password generator" onClose={closePanel}>
            <PasswordGenerator />
          </Panel>
        )}

        {panel === 'settings' && (
          <Panel title="Settings" onClose={closePanel}>
            <SettingsPanel settings={settings} onApply={applySettings} />
          </Panel>
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

        {/* Entry count */}
        {entries.length > 0 && (
          <p className="mt-6 text-center text-xs text-zinc-600">
            {entries.length} credential{entries.length !== 1 ? 's' : ''} · encrypted with AES-256-GCM
          </p>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Panel({
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

function EmptyState({ hasEntries, onAdd }: { hasEntries: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <span className="text-5xl">🔑</span>
      <p className="text-lg font-semibold text-white">
        {hasEntries ? 'No results found' : 'Your vault is empty'}
      </p>
      {!hasEntries && (
        <>
          <p className="text-sm text-zinc-500">
            Add your first credential to get started.
          </p>
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
}: {
  settings: ReturnType<typeof useVault>['settings']
  onApply: ReturnType<typeof useVault>['applySettings']
}) {
  const [vaultIdInput, setVaultIdInput] = useState(settings.vaultId)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await onApply({ backend: settings.backend, vaultId: vaultIdInput })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const exportVault = () => {
    const raw = localStorage.getItem('roko-settings')
    const a = document.createElement('a')
    a.href = `data:application/json,${encodeURIComponent(JSON.stringify({ settings: raw ? JSON.parse(raw) : settings }))}`
    a.download = 'roko-settings.json'
    a.click()
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

      {/* Vault ID (for remote sync / cross-device) */}
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

      {/* Export */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-400">Export settings</p>
        <button
          type="button"
          onClick={exportVault}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Download settings.json
        </button>
      </div>

      <p className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-500">
        🔒 Your vault data is encrypted with AES-256-GCM before leaving your device.
        The master password is never stored or transmitted.
      </p>
    </div>
  )
}
