'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { VaultEntry, EntryType, EntryDraft, Collection, CredentialTemplate } from '@roko/vault-core/lib/types'
import { useVault } from './VaultProvider'
import { useTheme } from '@roko/ui/ThemeProvider'
import { RokoLogo } from '@roko/ui/RokoLogo'
import { CredentialForm } from './CredentialForm'
import { ENTRY_TYPES } from './entryMeta'
import { InfraDetail } from './InfraDetail'
import { FieldRow } from './FieldRow'
import { TemplateManager } from './TemplateManager'
import { ResizeHandle, useResizableWidth } from '@roko/ui/components/ResizeHandle'
import { Drawer } from '@roko/ui/components/Drawer'
import { TemplateTile, TemplateGlyph } from './TemplateIcon'
import { TemplateFieldsView } from './InfraDetail'
import { builtinIdFor, templateForEntry } from '@roko/vault-core/lib/templates'
import { DEFAULT_PORT, hostWithPort, vpnProtocolMeta, inspectPrivateKey } from '@roko/vault-core/lib/infra'
import { PasswordGenerator } from './PasswordGenerator'
import { RecoveryPhraseDisplay } from './RecoveryPhraseDisplay'
import { Button } from '@roko/ui/components/base/buttons/button'
import { ModalOverlay, Modal, Dialog } from '@roko/ui/components/application/modals/modal'
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
  RefreshCw01,
  ShieldTick,
  Edit03,
  Building07,
  HardDrive,
  Download01,
  Eye,
  LogOut01,
  SwitchHorizontal01,
  CheckCircle,
  AlertTriangle,
  LayoutAlt04,
} from '@untitledui/icons'

type Panel = 'none' | 'add' | 'edit' | 'settings' | 'generator' | 'templates'

const PANEL_TITLES: Record<Panel, string> = {
  none: '',
  add: 'Add item',
  edit: 'Edit item',
  settings: 'Settings',
  generator: 'Password generator',
  templates: 'Templates',
}
type Category = 'all' | 'favorites' | 'ssh' | 'rdp' | 'vpn' | 'logins' | 'cards' | 'notes' | 'passkeys' | 'trash'
type View = { kind: 'category'; category: Category } | { kind: 'collection'; id: string } | { kind: 'template'; id: string }

type NavItem = { id: Category; label: string; icon: React.ElementType }

// Sidebar sections. Infrastructure comes first: this is a developer / enterprise vault.
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Library',
    items: [
      { id: 'all', label: 'All items', icon: Grid01 },
      { id: 'favorites', label: 'Favorites', icon: Star01 },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { id: 'ssh', label: ENTRY_TYPES.ssh.plural, icon: ENTRY_TYPES.ssh.icon },
      { id: 'rdp', label: ENTRY_TYPES.rdp.plural, icon: ENTRY_TYPES.rdp.icon },
      { id: 'vpn', label: ENTRY_TYPES.vpn.plural, icon: ENTRY_TYPES.vpn.icon },
    ],
  },
  {
    title: 'Credentials',
    items: [
      { id: 'logins', label: 'Logins', icon: Lock01 },
      { id: 'passkeys', label: 'Passkeys', icon: Fingerprint01 },
      { id: 'notes', label: 'Secure notes', icon: File01 },
      { id: 'cards', label: 'Cards', icon: CreditCard01 },
      { id: 'trash', label: 'Trash', icon: Trash01 },
    ],
  },
]

const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)


function inCategory(e: VaultEntry, cat: Category): boolean {
  if (cat === 'trash') return !!e.deletedAt
  if (e.deletedAt) return false
  switch (cat) {
    case 'all': return true
    case 'favorites': return e.favorite
    case 'ssh': return e.type === 'ssh'
    case 'rdp': return e.type === 'rdp'
    case 'vpn': return e.type === 'vpn'
    case 'logins': return e.type === 'login'
    case 'cards': return e.type === 'card'
    case 'notes': return e.type === 'note'
    case 'passkeys': return e.type === 'passkey'
  }
}

/** One-line summary shown under an infrastructure item's title in the list. */
function infraSubtitle(e: VaultEntry, template?: CredentialTemplate): string {
  if (e.type === 'custom') {
    // First plain (non-secret) value, so the list shows something recognisable.
    const f = template?.fields.find((x) => (x.kind === 'text' || x.kind === 'url' || x.kind === 'email' || x.kind === 'number') && e.fields?.[x.id])
    return f ? e.fields![f.id] : template?.name ?? 'Custom item'
  }
  if (e.type === 'ssh') {
    const target = hostWithPort(e.host, e.port, DEFAULT_PORT.ssh)
    if (target) return e.username ? `${e.username}@${target}` : target
    const algo = e.privateKey ? inspectPrivateKey(e.privateKey).algorithm : null
    return algo ? `SSH key · ${algo}` : 'SSH key'
  }
  if (e.type === 'rdp') {
    const user = e.username ? (e.domain ? `${e.domain}\\${e.username}` : e.username) : ''
    const target = hostWithPort(e.host, e.port, DEFAULT_PORT.rdp)
    return user ? `${user} @ ${target}` : target
  }
  const proto = vpnProtocolMeta(e.vpnProtocol).label
  return e.host ? `${proto} · ${e.host}` : proto
}

function addTypeFor(view: View): EntryType {
  if (view.kind !== 'category') return 'login'
  if (view.category === 'cards') return 'card'
  if (view.category === 'notes') return 'note'
  if (view.category === 'passkeys') return 'passkey'
  if (view.category === 'ssh') return 'ssh'
  if (view.category === 'rdp') return 'rdp'
  if (view.category === 'vpn') return 'vpn'
  return 'login'
}

function Logo({ size = 24 }: { size?: number }) {
  return <RokoLogo size={size} />
}

function EntryAvatar({ entry, size = 32, template }: { entry: VaultEntry; size?: number; template?: CredentialTemplate }) {
  if (template) return <TemplateTile icon={template.icon} size={size} />
  const meta = ENTRY_TYPES[entry.type]
  if (meta.infra) {
    const Icon = meta.icon
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          background: 'var(--ink-900)',
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.08)',
          color: 'var(--ember-500)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={Math.round(size * 0.5)} />
      </span>
    )
  }
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
        color: 'var(--color-on-brand)',
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
        (() => { const Icon = meta.icon; return <Icon size={Math.round(size * 0.5)} /> })()
      )}
    </span>
  )
}

export function VaultDashboard({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
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
    mode,
    org,
    readOnly,
    syncState,
    templates,
    clearRecoveryPhrase,
    recoveryPhrase,
    needsNewPassword,
    changeMasterPassword,
  } = useVault()
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>('none')
  const [view, setView] = useState<View>({ kind: 'category', category: 'all' })
  const [editing, setEditing] = useState<VaultEntry | null>(null)
  const [selectedRef, setSelected] = useState<VaultEntry | null>(null)
  // Always show the current version of the selected item (after edits or changes synced from others).
  const selected = useMemo(
    () => (selectedRef ? entries.find((e) => e.id === selectedRef.id) ?? null : null),
    [selectedRef, entries],
  )
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  // Set when "Use" is clicked in the template manager.
  const [addTemplateId, setAddTemplateId] = useState<string | undefined>()
  const [addTypeOverride, setAddTypeOverride] = useState<EntryType | undefined>()

  // Collections UI
  const [addingCollection, setAddingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [collectionConfirm, setCollectionConfirm] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCollection, setDragOverCollection] = useState<string | null>(null)

  const activeCollectionId = view.kind === 'collection' ? view.id : null

  // Resizable columns (remembered per browser). The detail panel keeps at least 440px.
  const [viewportWidth, setViewportWidth] = useState(1440)
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const sidebar = useResizableWidth('roko-layout-sidebar', { initial: 240, min: 200, max: 360 })
  const drawer = useResizableWidth('roko-layout-drawer', {
    initial: 520,
    min: 400,
    max: Math.max(400, Math.min(860, viewportWidth - 120)),
  })
  const list = useResizableWidth('roko-layout-list', {
    initial: 320,
    min: 260,
    max: Math.max(260, Math.min(560, viewportWidth - sidebar.width - 440)),
  })
  const tplById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])
  const customTemplates = templates.filter((t) => t.base === 'custom')
  // The vault's customised SSH / RDP / VPN templates (renamed, new icon) show in the sidebar.
  const builtinOverride = (category: string) =>
    category === 'ssh' || category === 'rdp' || category === 'vpn' ? tplById.get(builtinIdFor(category)) : undefined
  const builtinName = (category: string) => builtinOverride(category)?.name

  const counts = useMemo(() => {
    const live = entries.filter((e) => !e.deletedAt)
    return {
      all: live.length,
      favorites: live.filter((e) => e.favorite).length,
      ssh: live.filter((e) => e.type === 'ssh').length,
      rdp: live.filter((e) => e.type === 'rdp').length,
      vpn: live.filter((e) => e.type === 'vpn').length,
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
        : view.kind === 'template'
          ? entries.filter((e) => !e.deletedAt && e.templateId === view.id)
          : entries.filter((e) => inCategory(e, view.category))
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q) ||
        (e.cardholder ?? '').toLowerCase().includes(q) ||
        [e.host, e.domain, e.gateway, e.jumpHost].some((v) => (v ?? '').toLowerCase().includes(q)) ||
        // Plain (non-secret) template field values are searchable too.
        (!!e.fields &&
          !!templateForEntry(e, templates)?.fields.some(
            (f) => f.kind !== 'secret' && f.kind !== 'secretMultiline' && (e.fields?.[f.id] ?? '').toLowerCase().includes(q),
          )),
    )
  }, [entries, query, view, templates])

  const viewTitle =
    view.kind === 'collection'
      ? collections.find((c) => c.id === view.id)?.name ?? 'Collection'
      : view.kind === 'template'
        ? tplById.get(view.id)?.name ?? 'Template'
        : builtinName(view.category) ?? NAV_ITEMS.find((n) => n.id === view.category)?.label ?? 'All items'

  const openEdit = useCallback((entry: VaultEntry) => {
    setEditing(entry)
    setPanel('edit')
  }, [])

  const closePanel = useCallback(() => {
    setPanel('none')
    setEditing(null)
    setAddTemplateId(undefined)
    setAddTypeOverride(undefined)
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
    setAddTemplateId(undefined)
    setAddTypeOverride(undefined)
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
        gridTemplateColumns: `${sidebar.width}px ${list.width}px minmax(0, 1fr)`,
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
      }}
    >
      {/* ── Left Sidebar ── */}
      <aside
        style={{
          position: 'relative',
          background: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ResizeHandle label="Resize sidebar" width={sidebar.width} min={sidebar.min} max={sidebar.max} onResize={sidebar.setWidth} onReset={sidebar.reset} />
        {/* Logo */}
        <div style={{ padding: '16px 12px 12px', borderBottom: '1px solid var(--color-border-secondary)' }}>
          <Logo size={26} />
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
              boxShadow: 'var(--roko-shadow-sm)',
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
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.title}>
              <div className="roko-eyebrow" style={{ display: 'flex', fontSize: 10, padding: si === 0 ? '8px 8px 8px' : '16px 8px 8px' }}>
                {section.title}
              </div>
          {section.items.map((item) => {
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
                  color: active ? 'var(--color-text-brand-secondary)' : 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 1,
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                {builtinOverride(item.id) ? (
                  <span style={{ width: 15, display: 'inline-flex', justifyContent: 'center' }}>
                    <TemplateGlyph icon={builtinOverride(item.id)!.icon} size={15} />
                  </span>
                ) : (
                  <Icon size={15} />
                )}
                <span style={{ flex: 1 }}>{builtinName(item.id) ?? item.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
            </div>
          ))}

          {/* Templates: one category per template built from scratch, plus the manager */}
          <div className="roko-eyebrow" style={{ display: 'flex', fontSize: 10, padding: '16px 8px 8px' }}>
            <span style={{ flex: 1 }}>Templates</span>
          </div>
          {customTemplates.map((t) => {
            const active = view.kind === 'template' && view.id === t.id
            const count = entries.filter((e) => !e.deletedAt && e.templateId === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => selectView({ kind: 'template', id: t.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6,
                  background: active ? 'var(--color-bg-primary)' : 'transparent',
                  boxShadow: active ? 'var(--roko-shadow-sm)' : 'none',
                  color: active ? 'var(--color-text-brand-secondary)' : 'var(--color-text-secondary)',
                  fontSize: 13, fontWeight: active ? 600 : 500, border: 0, cursor: 'pointer', textAlign: 'left', marginBottom: 1,
                }}
              >
                <span style={{ width: 15, display: 'inline-flex', justifyContent: 'center' }}><TemplateGlyph icon={t.icon} size={15} /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                {count > 0 && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{count}</span>}
              </button>
            )
          })}
          <button
            onClick={() => openPanel('templates')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6,
              background: panel === 'templates' ? 'var(--color-bg-primary)' : 'transparent',
              color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 500, border: 0, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <LayoutAlt04 size={15} />
            <span style={{ flex: 1 }}>Manage templates</span>
          </button>

          {/* Collections */}
          <div
            className="roko-eyebrow"
            style={{
              fontSize: 10,
              padding: '16px 8px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ flex: 1 }}>Collections</span>
            <button
              onClick={() => { setAddingCollection(true); setNewCollectionName('') }}
              hidden={readOnly}
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
                    ? 'var(--ember-a12)'
                    : active
                      ? 'var(--color-bg-primary)'
                      : 'transparent',
                  boxShadow: isOver ? 'inset 0 0 0 1px var(--color-border-brand)' : 'none',
                  color: active ? 'var(--color-text-brand-secondary)' : 'var(--color-text-secondary)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                <Folder size={14} color={active ? 'var(--color-fg-brand-primary)' : 'var(--color-fg-quaternary)'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                {collectionCounts[c.id] > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{collectionCounts[c.id]}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.name) }}
                  title="Rename"
                  hidden={readOnly}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-fg-quaternary)', display: 'flex', padding: 0 }}
                  aria-label="Rename collection"
                >
                  <Edit03 size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCollection(c.id) }}
                  hidden={readOnly}
                  title={collectionConfirm === c.id ? 'Click again to delete' : 'Delete collection'}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: collectionConfirm === c.id ? 'var(--color-fg-error-primary)' : 'var(--color-fg-quaternary)', display: 'flex', padding: 0 }}
                  aria-label="Delete collection"
                >
                  <Trash01 size={12} />
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
            <span style={{ flex: 1, font: '500 11px/1 var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
              {theme === 'dark' ? 'Dark' : 'Light'} mode
            </span>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
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
                color: 'var(--color-on-brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              RP
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mode === 'org' ? org.activeVault?.name ?? 'Org vault' : 'Personal vault'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {mode === 'org' ? <Building07 size={11} /> : <HardDrive size={11} />}
                {mode === 'org' ? (readOnly ? 'View only' : syncState === 'saving' ? 'Saving…' : syncState === 'error' ? 'Not saved' : 'Synced') : 'This device'}
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
          position: 'relative',
          borderRight: '1px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ResizeHandle label="Resize item list" width={list.width} min={list.min} max={list.max} onResize={list.setWidth} onReset={list.reset} />
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
          {readOnly ? (
            <span className="roko-tag" style={{ gap: 4 }}><Eye size={11} /> View only</span>
          ) : view.kind === 'category' && view.category === 'trash' ? null : (
            <button
              onClick={() => openPanel('add')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                background: 'var(--color-bg-brand-solid)',
                color: 'var(--color-on-brand)',
                fontSize: 13,
                fontWeight: 600,
                border: 0,
                cursor: 'pointer',
                boxShadow: 'var(--roko-shadow-sm)',
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
                      : view.kind === 'category' && view.category === 'trash'
                        ? 'Deleted items will appear here.'
                        : 'Add your first item to get started.'}
                  </p>
                )}
              </div>
              {!readOnly && !(view.kind === 'category' && view.category === 'trash') && !query && (
                <button
                  onClick={() => openPanel('add')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 999,
                    background: 'var(--color-bg-brand-solid)',
                    color: 'var(--color-on-brand)',
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
                ENTRY_TYPES[entry.type].infra
                  ? infraSubtitle(entry, templateForEntry(entry, templates))
                  : entry.type === 'card'
                  ? entry.cardNumber
                    ? `•••• ${entry.cardNumber.replace(/\s/g, '').slice(-4)}`
                    : 'Card'
                  : entry.type === 'note'
                    ? 'Secure note'
                    : entry.username || entry.url
              return (
                <div
                  key={entry.id}
                  draggable={!entry.deletedAt && !readOnly}
                  onDragStart={(e) => { setDragId(entry.id); e.dataTransfer.setData('text/plain', entry.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { setDragId(null); setDragOverCollection(null) }}
                  onClick={() => { setSelected(isSelected ? null : entry); setPanel('none') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--color-border-secondary)',
                    background: isSelected ? 'var(--ember-a12)' : 'transparent',
                    opacity: dragId === entry.id ? 0.5 : 1,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <EntryAvatar entry={entry} size={32} template={templateForEntry(entry, templates)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: isSelected ? 'var(--color-text-brand-secondary)' : 'var(--color-text-primary)',
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
                  {!entry.deletedAt && !readOnly && (
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
        {selected && (
          <CredentialDetail
            entry={selected}
            template={templateForEntry(selected, templates)}
            readOnly={readOnly}
            collections={collections}
            onEdit={openEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onToggleFavorite={toggleFavorite}
            onMoveToCollection={moveEntryToCollection}
            deleteConfirm={deleteConfirm}
          />
        )}

        {!selected && (
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
                background: 'var(--ember-a12)',
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

      {/* ── Pop-out panels (slide in from the right) ── */}
      <Drawer
        open={panel !== 'none' && (panel !== 'edit' || !!editing)}
        title={PANEL_TITLES[panel]}
        onClose={closePanel}
        width={drawer.width}
        resize={{ min: drawer.min, max: drawer.max, onResize: drawer.setWidth, onReset: drawer.reset }}
      >
        {panel === 'add' && (
          <CredentialForm
            defaultType={addTypeOverride ?? addTypeFor(view)}
            templates={templates}
            defaultTemplateId={addTemplateId ?? (view.kind === 'template' ? view.id : undefined)}
            onSave={handleAdd}
            onCancel={closePanel}
          />
        )}

        {panel === 'edit' && editing && (
          <CredentialForm initial={editing} templates={templates} onSave={handleUpdate} onCancel={closePanel} />
        )}

        {panel === 'generator' && (
          <PasswordGenerator />
        )}

        {panel === 'templates' && (
          <TemplateManager
            onUse={(id) => {
              setAddTemplateId(id.startsWith('builtin:') ? undefined : id)
              setAddTypeOverride(id.startsWith('builtin:') ? (id.slice(8) as EntryType) : undefined)
              setPanel('add')
            }}
          />
        )}

        {panel === 'settings' && (
          <SettingsPanel onOpenAdmin={onOpenAdmin} />
        )}
      </Drawer>

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

// ─── Credential detail view ────────────────────────────────────────────────────

function CredentialDetail({
  entry,
  collections,
  onEdit,
  onDelete,
  onRestore,
  onToggleFavorite,
  onMoveToCollection,
  deleteConfirm,
  template,
  readOnly,
}: {
  entry: VaultEntry
  collections: Collection[]
  onEdit: (e: VaultEntry) => void
  onDelete: (e: VaultEntry) => void
  onRestore: (id: string) => void
  onToggleFavorite: (id: string) => void
  onMoveToCollection: (id: string, collectionId: string | null) => void
  deleteConfirm: string | null
  template?: CredentialTemplate
  readOnly: boolean
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
        <EntryAvatar entry={entry} size={48} template={template} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.01em' }}>{entry.title}</h2>
          {ENTRY_TYPES[entry.type].infra && (
            <div style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
              <span className="roko-tag" style={{ marginInlineEnd: 8, padding: '0 8px', fontSize: 10 }}>
                {template ? template.name : entry.type === 'vpn' ? vpnProtocolMeta(entry.vpnProtocol).label : ENTRY_TYPES[entry.type].label}
              </span>
              {entry.type === 'vpn' ? entry.host : entry.type === 'custom' ? '' : infraSubtitle(entry, template)}
            </div>
          )}
          {entry.url && (entry.type === 'login' || entry.type === 'passkey') && (
            <a
              href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--color-text-brand-secondary)', textDecoration: 'none' }}
            >
              {entry.url}
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!trashed && !readOnly && (
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
          {readOnly ? (
            <span className="roko-tag" style={{ gap: 4, alignSelf: 'center' }}><Eye size={11} /> View only</span>
          ) : trashed ? (
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
            hidden={readOnly}
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

        {ENTRY_TYPES[entry.type].infra && <InfraDetail entry={entry} />}
        {(template || entry.templateId || entry.type === 'custom') && <TemplateFieldsView entry={entry} template={template} />}

        {entry.type === 'passkey' && (
          <>
            <FieldRow label="Relying party" value={entry.url} />
            {entry.username && <FieldRow label="Username" value={entry.username} />}
          </>
        )}

        {entry.notes && (
          <div>
            <div style={{ font: '500 10px/1.4 var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
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
            <div style={{ font: '500 10px/1.4 var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
              Collection
            </div>
            <select
              value={entry.collectionId ?? ''}
              onChange={(e) => onMoveToCollection(entry.id, e.target.value || null)}
              disabled={readOnly}
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

function SettingsPanel({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const { mode, org, canExport, exportToFile, setupRecovery, hasRecovery, error, clearError, closeOrgVault, orgSignOut } = useVault()
  const [exportLoading, setExportLoading] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const vault = org.activeVault
  const isOrg = mode === 'org'

  const sectionTitle = (label: string) => (
    <div style={{ font: '500 10px/1.4 var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
      {label}
    </div>
  )
  const note: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 10px', lineHeight: 1.55 }

  const handleExport = async () => {
    setExportMsg(null)
    setExportLoading(true)
    try {
      await exportToFile(isOrg ? exportPassword : undefined)
      setExportPassword('')
      if (isOrg) setExportMsg({ ok: true, text: 'Downloaded. Open it later with "Open vault from file" and this file password.' })
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setExportMsg({ ok: false, text: err instanceof Error ? err.message : 'Download failed.' })
      }
    } finally {
      setExportLoading(false)
    }
  }

  const handleSetupRecovery = async () => {
    clearError()
    setRecoveryLoading(true)
    try { await setupRecovery() } finally { setRecoveryLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Where this vault lives */}
      <div>
        {sectionTitle(isOrg ? 'Organization vault' : 'Personal vault')}
        {isOrg && vault ? (
          <div style={{ padding: 12, borderRadius: 14, border: '1px solid var(--color-border-secondary)', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
              <Building07 size={15} color="var(--color-fg-brand-primary)" /> {vault.name}
            </div>
            <div style={{ font: '400 12px/1.6 var(--font-mono)', color: 'var(--color-text-tertiary)', margin: '4px 0 10px' }}>
              {org.session?.email} · {org.session?.serverUrl.replace(/^https?:\/\//, '')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <span className="roko-tag" style={{ gap: 4 }}>
                {vault.canWrite ? <Edit03 size={11} /> : <Eye size={11} />} {vault.canWrite ? 'Can edit' : 'View only'}
              </span>
              <span className="roko-tag" style={{ gap: 4 }}>
                <Download01 size={11} /> {vault.canExport ? 'Download allowed' : 'No download'}
              </span>
              {org.me?.role === 'admin' && <span className="roko-tag">Org admin</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button type="button" color="secondary" size="sm" iconLeading={SwitchHorizontal01} onClick={closeOrgVault}>Switch vault</Button>
              {org.me?.role === 'admin' && onOpenAdmin && (
                <Button type="button" color="secondary" size="sm" iconLeading={Settings01} onClick={onOpenAdmin}>Admin console</Button>
              )}
              <Button type="button" color="tertiary" size="sm" iconLeading={LogOut01} onClick={() => void orgSignOut()}>Sign out</Button>
            </div>
          </div>
        ) : (
          <p style={note}>
            Stored encrypted on this device only. To work with your team, lock this vault and choose <strong>Organization</strong> on the sign-in screen.
          </p>
        )}
      </div>

      {/* Download */}
      <div>
        {sectionTitle(isOrg ? 'Download a copy' : 'Portable backup')}
        {!canExport ? (
          <p style={{ ...note, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Lock01 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Your org admin hasn&apos;t allowed downloading this vault.
          </p>
        ) : isOrg ? (
          <>
            <p style={note}>
              Saves a standalone encrypted <code>.rkpw</code> file protected by a password you choose now. Your admin can see that you downloaded it.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="File password (8+ characters)"
                autoComplete="new-password"
                style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--color-border-primary)', borderRadius: 10, background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', fontSize: 13, outline: 'none' }}
              />
              <Button type="button" onClick={handleExport} isDisabled={exportLoading || exportPassword.length < 8} isLoading={exportLoading} color="secondary" size="sm" iconLeading={Download01}>
                Download
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={note}>Save a copy of your encrypted vault as a <code>.rkpw</code> file.</p>
            <Button type="button" onClick={handleExport} isDisabled={exportLoading} isLoading={exportLoading} color="secondary" size="sm" iconLeading={Download01}>
              Export vault to file
            </Button>
          </>
        )}
        {exportMsg && (
          <p style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, fontSize: 12, background: exportMsg.ok ? 'var(--color-bg-success-primary)' : 'var(--color-bg-error-primary)', color: exportMsg.ok ? 'var(--color-fg-success-primary)' : 'var(--color-fg-error-primary)' }}>
            {exportMsg.text}
          </p>
        )}
      </div>

      {/* Recovery (personal vault only: org accounts are recovered through the admin) */}
      {!isOrg && (
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
              {hasRecovery ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              {hasRecovery ? 'Recovery enabled' : 'No recovery set up'}
            </span>
          </div>
          <p style={note}>
            {hasRecovery
              ? 'Your vault can be recovered using your 12-word phrase.'
              : 'Without a recovery phrase, a forgotten master password means permanent data loss.'}
          </p>
          <Button type="button" onClick={handleSetupRecovery} isDisabled={recoveryLoading} isLoading={recoveryLoading} color="secondary" size="sm" iconLeading={hasRecovery ? RefreshCw01 : ShieldTick}>
            {hasRecovery ? 'Rotate recovery phrase' : 'Set up recovery phrase'}
          </Button>
        </div>
      )}

      {error && (
        <p style={{ margin: 0, padding: '8px 12px', borderRadius: 10, background: 'var(--color-bg-error-primary)', color: 'var(--color-fg-error-primary)', fontSize: 12 }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 10, fontSize: 11, lineHeight: 1.55, color: 'var(--color-text-tertiary)' }}>
        <ShieldTick size={14} style={{ flexShrink: 0 }} />
        {isOrg
          ? 'Items are encrypted on your device with the vault key before they are sent. The server stores only ciphertext.'
          : 'All data is encrypted with AES-256-GCM before leaving your device. The master password is never stored.'}
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
