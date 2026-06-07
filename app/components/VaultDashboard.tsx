'use client'

import { useState, useMemo, useCallback } from 'react'
import type { VaultEntry, EntryType, EntryDraft, Collection } from '@/lib/types'
import { useVault } from './VaultProvider'
import { useTheme, ACCENTS } from './ThemeProvider'
import { CredentialForm } from './CredentialForm'
import { PasswordGenerator } from './PasswordGenerator'
import { RecoveryPhraseDisplay } from './RecoveryPhraseDisplay'
import { UploadToServer } from './UploadToServer'
import { Button } from '@/components/base/buttons/button'
import { ModalOverlay, Modal, Dialog } from '@/components/application/modals/modal'
import {
  Grid01,
  Star01,
  Lock01,
  CreditCard01,
  File01,
  Fingerprint01,
  Trash01,
  Folder,
  Settings01,
  SearchMd,
  Plus,
  Moon01,
  Sun,
  LockUnlocked01,
  ChevronRight,
  Eye,
  EyeOff,
  Copy01,
  RefreshCw01,
  ShieldTick,
} from '@untitledui/icons'

type Panel = 'none' | 'add' | 'edit' | 'settings' | 'generator'
type Category = 'all' | 'favorites' | 'logins' | 'cards' | 'notes' | 'passkeys' | 'trash'
type View = { kind: 'category'; category: Category } | { kind: 'collection'; id: string }

const NAV_ITEMS: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All items', icon: Grid01 },
  { id: 'favorites', label: 'Favorites', icon: Star01 },
  { id: 'logins', label: 'Logins', icon: Lock01 },
  { id: 'cards', label: 'Cards', icon: CreditCard01 },
  { id: 'notes', label: 'Secure notes', icon: File01 },
  { id: 'passkeys', label: 'Passkeys', icon: Fingerprint01 },
  { id: 'trash', label: 'Trash', icon: Trash01 },
]

const TYPE_EMOJI: Record<EntryType, string> = { login: '🔑', card: '💳', note: '📝', passkey: '🔐' }

function inCategory(e: VaultEntry, cat: Category): boolean {
  if (cat === 'trash') return !!e.deletedAt
  if (e.deletedAt) return false
  switch (cat) {
    case 'all': return true
    case 'favorites': return e.favorite
    case 'logins': return e.type === 'login'
    case 'cards': return e.type === 'card'
    case 'notes': return e.type === 'note'
    case 'passkeys': return e.type === 'passkey'
  }
}

function addTypeFor(view: View): EntryType {
  if (view.kind !== 'category') return 'login'
  if (view.category === 'cards') return 'card'
  if (view.category === 'notes') return 'note'
  if (view.category === 'passkeys') return 'passkey'
  return 'login'
}

function Logo({ size = 24 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: 'var(--color-bg-brand-solid)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock01 size={size * 0.6} color="#fff" />
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: size * 0.64,
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary)',
        }}
      >
        Lila<span style={{ color: 'var(--color-bg-brand-solid)' }}>Crypt</span>
      </span>
    </span>
  )
}

function EntryAvatar({ entry, size = 32 }: { entry: VaultEntry; size?: number }) {
  const favicon =
    entry.type === 'login' && entry.url
      ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(entry.url)}`
      : null
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: entry.type === 'card' ? 8 : '50%',
        background: 'var(--color-bg-brand-solid)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon}
          alt=""
          width={size * 0.625}
          height={size * 0.625}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : entry.type === 'login' ? (
        entry.title.slice(0, 2).toUpperCase()
      ) : (
        TYPE_EMOJI[entry.type]
      )}
    </span>
  )
}

export function VaultDashboard() {
  const {
    entries,
    collections,
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
  const { theme, toggleTheme, accent, setAccent } = useTheme()
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>('none')
  const [view, setView] = useState<View>({ kind: 'category', category: 'all' })
  const [editing, setEditing] = useState<VaultEntry | null>(null)
  const [selected, setSelected] = useState<VaultEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Collections UI
  const [addingCollection, setAddingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [collectionConfirm, setCollectionConfirm] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null)

  const activeCollectionId = view.kind === 'collection' ? view.id : null

  const counts = useMemo(() => {
    const live = entries.filter((e) => !e.deletedAt)
    return {
      all: live.length,
      favorites: live.filter((e) => e.favorite).length,
      logins: live.filter((e) => e.type === 'login').length,
      cards: live.filter((e) => e.type === 'card').length,
      notes: live.filter((e) => e.type === 'note').length,
      passkeys: live.filter((e) => e.type === 'passkey').length,
      trash: entries.filter((e) => !!e.deletedAt).length,
    } as Record<Category, number>
  }, [entries])

  const collectionCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of entries) {
      if (!e.deletedAt && e.collectionId) m[e.collectionId] = (m[e.collectionId] ?? 0) + 1
    }
    return m
  }, [entries])

  const filtered = useMemo(() => {
    const base =
      view.kind === 'collection'
        ? entries.filter((e) => !e.deletedAt && e.collectionId === view.id)
        : entries.filter((e) => inCategory(e, view.category))
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        (e.cardholder ?? '').toLowerCase().includes(q),
    )
  }, [entries, query, view])

  const viewTitle =
    view.kind === 'collection'
      ? collections.find((c) => c.id === view.id)?.name ?? 'Collection'
      : NAV_ITEMS.find((n) => n.id === view.category)?.label ?? 'All items'

  const openEdit = useCallback((entry: VaultEntry) => {
    setEditing(entry)
    setSelected(null)
    setPanel('edit')
  }, [])

  const closePanel = useCallback(() => {
    setPanel('none')
    setEditing(null)
  }, [])

  const handleAdd = async (data: EntryDraft) => {
    await addEntry(data, activeCollectionId)
    closePanel()
  }

  const handleUpdate = async (data: EntryDraft) => {
    if (!editing) return
    await updateEntry(editing.id, data)
    closePanel()
  }

  // Trash (soft delete) with a 3s confirm window; from Trash view this deletes forever.
  const handleDelete = async (entry: VaultEntry) => {
    if (deleteConfirm === entry.id) {
      if (entry.deletedAt) await deleteForever(entry.id)
      else await trashEntry(entry.id)
      setDeleteConfirm(null)
      if (selected?.id === entry.id) setSelected(null)
    } else {
      setDeleteConfirm(entry.id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const handleRestore = async (id: string) => {
    await restoreEntry(id)
    if (selected?.id === id) setSelected((s) => (s ? { ...s, deletedAt: null } : s))
  }

  const openPanel = (p: Panel) => {
    setPanel((prev) => (prev === p ? 'none' : p))
    setEditing(null)
    setSelected(null)
  }

  const selectView = (v: View) => {
    setView(v)
    setSelected(null)
    setPanel('none')
  }

  const submitNewCollection = async () => {
    const name = newCollectionName.trim()
    if (!name) { setAddingCollection(false); return }
    const col = await addCollection(name)
    setNewCollectionName('')
    setAddingCollection(false)
    selectView({ kind: 'collection', id: col.id })
  }

  const submitRename = async (id: string) => {
    const name = renameValue.trim()
    if (name) await renameCollection(id, name)
    setRenamingId(null)
  }

  const handleDeleteCollection = async (id: string) => {
    if (collectionConfirm === id) {
      await deleteCollection(id)
      setCollectionConfirm(null)
      if (view.kind === 'collection' && view.id === id) selectView({ kind: 'category', category: 'all' })
    } else {
      setCollectionConfirm(id)
      setTimeout(() => setCollectionConfirm(null), 3000)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 320px 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      {/* ── Left Sidebar ── */}
      <aside
        style={{
          background: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--color-border-secondary)' }}>
          <Logo size={22} />
        </div>

        {/* Search */}
        <div style={{ padding: '12px 10px 8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 8,
              background: 'var(--color-bg-primary)',
              boxShadow: '0 1px 2px 0 rgba(16,24,40,.05)',
            }}
          >
            <SearchMd size={14} color="var(--color-fg-quaternary)" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vault…"
              style={{
                border: 0,
                outline: 0,
                flex: 1,
                fontSize: 13,
                color: 'var(--color-text-primary)',
                background: 'transparent',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              padding: '6px 8px 6px',
            }}
          >
            Library
          </div>
          {NAV_ITEMS.map((item) => {
            const active = view.kind === 'category' && view.category === item.id
            const Icon = item.icon
            const count = counts[item.id]
            return (
              <button
                key={item.id}
                onClick={() => selectView({ kind: 'category', category: item.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: active ? 'var(--color-bg-primary)' : 'transparent',
                  boxShadow: active ? '0 1px 2px 0 rgba(16,24,40,.05)' : 'none',
                  color: active ? 'var(--color-brand-700)' : 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 1,
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                <Icon size={15} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Collections */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              padding: '14px 8px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            Collections
            <button
              onClick={() => { setAddingCollection(true); setNewCollectionName('') }}
              title="New collection"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', display: 'flex', padding: 0 }}
            >
              <Plus size={12} />
            </button>
          </div>

          {addingCollection && (
            <input
              autoFocus
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onBlur={submitNewCollection}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewCollection()
                if (e.key === 'Escape') { setAddingCollection(false); setNewCollectionName('') }
              }}
              placeholder="Collection name"
              style={{
                width: '100%',
                padding: '5px 8px',
                marginBottom: 2,
                border: '1px solid var(--color-border-primary)',
                borderRadius: 6,
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          )}

          {collections.length === 0 && !addingCollection && (
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', padding: '2px 8px' }}>
              Drag items here to organise them.
            </p>
          )}

          {collections.map((c) => {
            const active = view.kind === 'collection' && view.id === c.id
            const isOver = dragOverCollection === c.id
            if (renamingId === c.id) {
              return (
                <input
                  key={c.id}
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(c.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '5px 8px',
                    marginBottom: 1,
                    border: '1px solid var(--color-border-brand)',
                    borderRadius: 6,
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              )
            }
            return (
              <div
                key={c.id}
                onClick={() => selectView({ kind: 'collection', id: c.id })}
                onDragOver={(e) => { e.preventDefault(); setDragOverCollection(c.id) }}
                onDragLeave={() => setDragOverCollection((p) => (p === c.id ? null : p))}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain') || dragId
                  if (id) moveEntryToCollection(id, c.id)
                  setDragOverCollection(null)
                  setDragId(null)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 6,
                  marginBottom: 1,
                  background: isOver
                    ? 'var(--color-brand-100)'
                    : active
                      ? 'var(--color-bg-primary)'
                      : 'transparent',
                  boxShadow: isOver ? 'inset 0 0 0 1px var(--color-border-brand)' : 'none',
                  color: active ? 'var(--color-brand-700)' : 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                <Folder size={14} color={active ? 'var(--color-brand-600)' : 'var(--color-fg-quaternary)'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {collectionCounts[c.id] > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{collectionCounts[c.id]}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.name) }}
                  title="Rename"
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', fontSize: 11, padding: 0 }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCollection(c.id) }}
                  title={collectionConfirm === c.id ? 'Click again to delete' : 'Delete collection'}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: collectionConfirm === c.id ? 'var(--color-fg-error-primary)' : 'var(--color-fg-quaternary)', fontSize: 11, padding: 0 }}
                >
                  🗑
                </button>
              </div>
            )
          })}
        </nav>

        {/* Bottom: theme + user */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid var(--color-border-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  title={a.label}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: a.color,
                    border: accent === a.id ? `2px solid var(--color-text-primary)` : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon01 size={13} />}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--color-bg-brand-solid)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              LC
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                LilaCrypt Vault
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {settings.backend === 'remote' ? '☁ Remote sync' : '💾 Local'}
              </div>
            </div>
            <button
              onClick={() => openPanel('settings')}
              title="Settings"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}
            >
              <Settings01 size={13} />
            </button>
            <button
              onClick={lock}
              title="Lock vault"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}
            >
              <LockUnlocked01 size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Middle: Credential List ── */}
      <section
        style={{
          borderRight: '1px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid var(--color-border-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{viewTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
          {view.kind === 'category' && view.category === 'trash' ? null : (
            <button
              onClick={() => openPanel('add')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                background: 'var(--color-bg-brand-solid)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                border: 0,
                cursor: 'pointer',
                boxShadow: '0 1px 2px 0 rgba(16,24,40,.05)',
              }}
            >
              <Plus size={13} />
              New
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                color: 'var(--color-text-tertiary)',
                padding: 32,
                textAlign: 'center',
              }}
            >
              <Lock01 size={40} color="var(--color-fg-quaternary)" />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                  {query ? 'No results found' : view.kind === 'category' && view.category === 'trash' ? 'Trash is empty' : 'Nothing here yet'}
                </p>
                {!query && (
                  <p style={{ fontSize: 13, margin: 0 }}>
                    {view.kind === 'collection'
                      ? 'Drag items onto this collection, or add a new one.'
                      : view.category === 'trash'
                        ? 'Deleted items will appear here.'
                        : 'Add your first item to get started.'}
                  </p>
                )}
              </div>
              {!(view.kind === 'category' && view.category === 'trash') && !query && (
                <button
                  onClick={() => openPanel('add')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 6,
                    background: 'var(--color-bg-brand-solid)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add item
                </button>
              )}
            </div>
          ) : (
            filtered.map((entry) => {
              const isSelected = selected?.id === entry.id
              const subtitle =
                entry.type === 'card'
                  ? entry.cardNumber
                    ? `•••• ${entry.cardNumber.replace(/\s/g, '').slice(-4)}`
                    : 'Card'
                  : entry.type === 'note'
                    ? 'Secure note'
                    : entry.username || entry.url
              return (
                <div
                  key={entry.id}
                  draggable={!entry.deletedAt}
                  onDragStart={(e) => { setDragId(entry.id); e.dataTransfer.setData('text/plain', entry.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { setDragId(null); setDragOverCollection(null) }}
                  onClick={() => { setSelected(isSelected ? null : entry); setPanel('none') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--color-border-secondary)',
                    background: isSelected ? 'var(--color-brand-50)' : 'transparent',
                    opacity: dragId === entry.id ? 0.5 : 1,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <EntryAvatar entry={entry} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: isSelected ? 'var(--color-brand-700)' : 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {subtitle}
                    </div>
                  </div>
                  {!entry.deletedAt && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.id) }}
                      title={entry.favorite ? 'Unfavorite' : 'Favorite'}
                      style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', padding: 2, color: entry.favorite ? 'var(--color-warning-solid, #f5a623)' : 'var(--color-fg-quaternary)' }}
                    >
                      <Star01 size={14} style={entry.favorite ? { fill: 'currentColor' } : undefined} />
                    </button>
                  )}
                  <ChevronRight size={13} color="var(--color-fg-quaternary)" />
                </div>
              )
            })
          )}
        </div>

        {/* Generator shortcut */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border-secondary)' }}>
          <button
            onClick={() => openPanel('generator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border-primary)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RefreshCw01 size={13} color="var(--color-fg-quaternary)" />
            Password generator
          </button>
        </div>
      </section>

      {/* ── Right Panel ── */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg-primary)' }}>
        {panel === 'add' && (
          <RightPanel title="Add item" onClose={closePanel}>
            <CredentialForm defaultType={addTypeFor(view)} onSave={handleAdd} onCancel={closePanel} />
          </RightPanel>
        )}

        {panel === 'edit' && editing && (
          <RightPanel title="Edit item" onClose={closePanel}>
            <CredentialForm initial={editing} onSave={handleUpdate} onCancel={closePanel} />
          </RightPanel>
        )}

        {panel === 'generator' && (
          <RightPanel title="Password generator" onClose={closePanel}>
            <PasswordGenerator />
          </RightPanel>
        )}

        {panel === 'settings' && (
          <RightPanel title="Settings" onClose={closePanel}>
            <SettingsPanel
              settings={settings}
              onApply={applySettings}
              onExport={exportToFile}
              onSetupRecovery={setupRecovery}
              hasRecovery={hasRecovery}
              error={error}
              clearError={clearError}
            />
          </RightPanel>
        )}

        {panel === 'none' && selected && (
          <CredentialDetail
            entry={selected}
            collections={collections}
            onEdit={openEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onToggleFavorite={toggleFavorite}
            onMoveToCollection={moveEntryToCollection}
            deleteConfirm={deleteConfirm}
          />
        )}

        {panel === 'none' && !selected && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 16,
              color: 'var(--color-text-tertiary)',
            }}
          >
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'var(--color-brand-100)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldTick size={32} color="var(--color-brand-600)" />
            </span>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                Select an item
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>Choose an item from the list to view its details.</p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 16 }}>
              {counts.all} item{counts.all !== 1 ? 's' : ''} · encrypted with AES-256-GCM
            </p>
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      <ModalOverlay isOpen={!!recoveryPhrase} isDismissable={false}>
        <Modal>
          <Dialog>
            <div className="w-full max-w-sm rounded-2xl border border-border-primary bg-secondary p-6 shadow-2xl">
              {recoveryPhrase && (
                <RecoveryPhraseDisplay words={recoveryPhrase} onConfirmed={clearRecoveryPhrase} />
              )}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <ModalOverlay isOpen={needsNewPassword && !recoveryPhrase} isDismissable={false}>
        <Modal>
          <Dialog>
            <div className="w-full max-w-sm rounded-2xl border border-border-primary bg-secondary p-6 shadow-2xl">
              <SetNewPasswordForm onSave={changeMasterPassword} />
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  )
}

// ─── Right panel wrapper ────────────────────────────────────────────────────────

function RightPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-border-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 14,
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
    </>
  )
}

// ─── Credential detail view ────────────────────────────────────────────────────

function FieldRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 8,
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: secret ? 'var(--font-mono, monospace)' : 'inherit',
            fontSize: 13,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {secret && !revealed ? '••••••••••••' : value}
        </span>
        {secret && (
          <button
            onClick={() => setRevealed((v) => !v)}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}
            title={revealed ? 'Hide' : 'Show'}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button
          onClick={copy}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: copied ? 'var(--color-brand-600)' : 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}
          title="Copy"
        >
          {copied ? '✓' : <Copy01 size={14} />}
        </button>
      </div>
    </div>
  )
}

function CredentialDetail({
  entry,
  collections,
  onEdit,
  onDelete,
  onRestore,
  onToggleFavorite,
  onMoveToCollection,
  deleteConfirm,
}: {
  entry: VaultEntry
  collections: Collection[]
  onEdit: (e: VaultEntry) => void
  onDelete: (e: VaultEntry) => void
  onRestore: (id: string) => void
  onToggleFavorite: (id: string) => void
  onMoveToCollection: (id: string, collectionId: string | null) => void
  deleteConfirm: string | null
}) {
  const trashed = !!entry.deletedAt

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--color-border-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <EntryAvatar entry={entry} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.01em' }}>{entry.title}</h2>
          {entry.url && (entry.type === 'login' || entry.type === 'passkey') && (
            <a
              href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--color-brand-700)', textDecoration: 'none' }}
            >
              {entry.url}
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!trashed && (
            <button
              onClick={() => onToggleFavorite(entry.id)}
              title={entry.favorite ? 'Unfavorite' : 'Favorite'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-primary)',
                color: entry.favorite ? 'var(--color-warning-solid, #f5a623)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Star01 size={15} style={entry.favorite ? { fill: 'currentColor' } : undefined} />
            </button>
          )}
          {trashed ? (
            <button
              onClick={() => onRestore(entry.id)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Restore
            </button>
          ) : (
            <button
              onClick={() => onEdit(entry)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onDelete(entry)}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: deleteConfirm === entry.id ? 'var(--color-bg-error-primary)' : 'transparent',
              color: 'var(--color-fg-error-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {deleteConfirm === entry.id ? (trashed ? 'Confirm delete' : 'Confirm trash') : trashed ? 'Delete forever' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        {entry.type === 'login' && (
          <>
            <FieldRow label="Username" value={entry.username} />
            <FieldRow label="Password" value={entry.password} secret />
            {entry.url && <FieldRow label="Website" value={entry.url} />}
          </>
        )}

        {entry.type === 'card' && (
          <>
            {entry.cardholder && <FieldRow label="Cardholder" value={entry.cardholder} />}
            {entry.cardNumber && <FieldRow label="Card number" value={entry.cardNumber} secret />}
            <div style={{ display: 'flex', gap: 16 }}>
              {entry.expiry && <div style={{ flex: 1 }}><FieldRow label="Expiry" value={entry.expiry} /></div>}
              {entry.cvv && <div style={{ flex: 1 }}><FieldRow label="CVV" value={entry.cvv} secret /></div>}
            </div>
          </>
        )}

        {entry.type === 'passkey' && (
          <>
            <FieldRow label="Relying party" value={entry.url} />
            {entry.username && <FieldRow label="Username" value={entry.username} />}
          </>
        )}

        {entry.notes && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Notes
            </div>
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                lineHeight: '20px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.notes}
            </div>
          </div>
        )}

        {/* Collection assignment */}
        {!trashed && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Collection
            </div>
            <select
              value={entry.collectionId ?? ''}
              onChange={(e) => onMoveToCollection(entry.id, e.target.value || null)}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            padding: '10px 12px',
            background: 'var(--color-bg-secondary)',
            borderRadius: 8,
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>Created {new Date(entry.createdAt).toLocaleDateString()}</span>
          {entry.updatedAt !== entry.createdAt && <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </>
  )
}

// ─── Settings Panel ────────────────────────────────────────────────────────────

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
  const { serverSession, logoutServer } = useVault()
  const [vaultIdInput, setVaultIdInput] = useState(settings.vaultId)
  const [saved, setSaved] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  // Reveal the server-connection sub-panel. True whenever the live backend is
  // already remote, or the user taps "Remote" to start connecting.
  const [showRemote, setShowRemote] = useState(settings.backend === 'remote')
  // Show the connect-and-upload flow inside the remote sub-panel.
  const [uploading, setUploading] = useState(false)

  const sectionTitle = (label: string) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
      {label}
    </div>
  )

  const save = async () => {
    await onApply({ backend: settings.backend, vaultId: vaultIdInput })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try { await onExport() } finally { setExportLoading(false) }
  }

  const handleSetupRecovery = async () => {
    clearError()
    setRecoveryLoading(true)
    try { await onSetupRecovery() } finally { setRecoveryLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Storage */}
      <div>
        {sectionTitle('Storage backend')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Button
            type="button"
            onClick={() => {
              setShowRemote(false)
              if (settings.backend === 'remote') onApply({ backend: 'local' }).catch(() => {})
            }}
            color={!showRemote ? 'primary' : 'secondary'}
            size="sm"
            className="flex-1"
          >
            💾 Local
          </Button>
          <Button
            type="button"
            onClick={() => setShowRemote(true)}
            color={showRemote ? 'primary' : 'secondary'}
            size="sm"
            className="flex-1"
          >
            ☁️ Remote
          </Button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
          {!showRemote
            ? 'Vault is stored in this browser only.'
            : 'Encrypted vault blob is synced to the server. The server never sees your passwords.'}
        </p>

        {showRemote && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-bg-secondary)',
            }}
          >
            {settings.backend === 'remote' ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                  ☁️ Synced to <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{serverSession?.serverUrl ?? settings.serverUrl}</span>
                </div>
                {serverSession && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                    Signed in as {serverSession.email}
                  </div>
                )}
                <Button type="button" onClick={() => logoutServer()} color="secondary" size="sm">
                  Disconnect
                </Button>
              </>
            ) : uploading ? (
              <UploadToServer onClose={() => setUploading(false)} />
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 10px' }}>
                  Upload an encrypted copy of this vault to a sync server so you can reach it from other devices.
                  {serverSession ? ` Connected to ${serverSession.serverUrl}.` : ''}
                </p>
                <Button type="button" onClick={() => { clearError(); setUploading(true) }} color="primary" size="sm">
                  ⬆ Upload this vault to a sync server
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Vault ID */}
      <div>
        {sectionTitle('Vault ID')}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={vaultIdInput}
            onChange={(e) => setVaultIdInput(e.target.value)}
            placeholder="vault-id"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 6,
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontFamily: 'monospace',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <Button type="button" onClick={save} color="secondary" size="sm">
            {saved ? '✓ Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Backup */}
      <div>
        {sectionTitle('Portable backup')}
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 10px' }}>
          Save a copy of your encrypted vault as a <code>.rkpw</code> file.
        </p>
        <Button type="button" onClick={handleExport} isDisabled={exportLoading} isLoading={exportLoading} color="secondary" size="sm">
          💾 Export vault to file
        </Button>
      </div>

      {/* Recovery */}
      <div>
        {sectionTitle('Recovery phrase')}
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 500,
              background: hasRecovery ? 'var(--color-bg-success-primary)' : 'var(--color-bg-warning-primary)',
              color: hasRecovery ? 'var(--color-fg-success-primary)' : 'var(--color-fg-warning-primary)',
            }}
          >
            {hasRecovery ? '✓ Recovery enabled' : '⚠ No recovery set up'}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 10px' }}>
          {hasRecovery
            ? 'Your vault can be recovered using your 12-word phrase.'
            : 'Without a recovery phrase, a forgotten master password means permanent data loss.'}
        </p>
        <Button type="button" onClick={handleSetupRecovery} isDisabled={recoveryLoading} isLoading={recoveryLoading} color="secondary" size="sm">
          {hasRecovery ? '🔄 Rotate recovery phrase' : '🛡 Set up recovery phrase'}
        </Button>
        {error && (
          <p style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'var(--color-bg-error-primary)', color: 'var(--color-fg-error-primary)', fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
        🔒 All data is encrypted with AES-256-GCM before leaving your device. The master password is never stored.
      </div>
    </div>
  )
}

// ─── Set New Password Modal ────────────────────────────────────────────────────

function SetNewPasswordForm({ onSave }: { onSave: (pw: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--color-border-primary)',
    borderRadius: 8,
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError('')
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return }
    setLoading(true)
    try { await onSave(password) } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Set a new master password</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>
          Your vault has been recovered. Create a new master password to protect it.
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
            New master password
          </label>
          <input type="password" autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
            Confirm password
          </label>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" required style={inputStyle} />
        </div>
        {localError && (
          <p style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--color-bg-error-primary)', color: 'var(--color-fg-error-primary)', fontSize: 12, margin: 0 }}>
            {localError}
          </p>
        )}
        <Button type="submit" isDisabled={loading} isLoading={loading} color="primary" size="md" className="w-full">
          Set new password
        </Button>
      </form>
    </div>
  )
}
