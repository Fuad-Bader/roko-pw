'use client'

import { useState, useMemo, useCallback } from 'react'
import type { VaultEntry } from '@/lib/types'
import { useVault } from './VaultProvider'
import { useTheme, ACCENTS } from './ThemeProvider'
import { CredentialCard } from './CredentialCard'
import { CredentialForm } from './CredentialForm'
import { PasswordGenerator } from './PasswordGenerator'
import { RecoveryPhraseDisplay } from './RecoveryPhraseDisplay'
import { Button } from '@/components/base/buttons/button'
import { ModalOverlay, Modal, Dialog } from '@/components/application/modals/modal'
import {
  Grid01,
  Star01,
  Lock01,
  CreditCard01,
  User01,
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
  Cloud01,
  ShieldTick,
} from '@untitledui/icons'

type Panel = 'none' | 'add' | 'edit' | 'settings' | 'generator'
type Category = 'all' | 'favorites' | 'logins' | 'cards' | 'notes' | 'passkeys' | 'trash'

const NAV_ITEMS: { id: Category; label: string; icon: React.ElementType; count?: boolean }[] = [
  { id: 'all', label: 'All items', icon: Grid01, count: true },
  { id: 'favorites', label: 'Favorites', icon: Star01 },
  { id: 'logins', label: 'Logins', icon: Lock01, count: true },
  { id: 'cards', label: 'Cards', icon: CreditCard01 },
  { id: 'notes', label: 'Secure notes', icon: File01 },
  { id: 'passkeys', label: 'Passkeys', icon: Fingerprint01 },
  { id: 'trash', label: 'Trash', icon: Trash01 },
]

const S: React.CSSProperties = {}

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
        Roko<span style={{ color: 'var(--color-bg-brand-solid)' }}>PW</span>
      </span>
    </span>
  )
}

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
  const { theme, toggleTheme, accent, setAccent } = useTheme()
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>('none')
  const [category, setCategory] = useState<Category>('all')
  const [editing, setEditing] = useState<VaultEntry | null>(null)
  const [selected, setSelected] = useState<VaultEntry | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    const base = category === 'all' ? entries : entries
    if (!q) return base
    return base.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q),
    )
  }, [entries, query, category])

  const openEdit = useCallback((entry: VaultEntry) => {
    setEditing(entry)
    setSelected(null)
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
      if (selected?.id === id) setSelected(null)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const openPanel = (p: Panel) => {
    setPanel((prev) => (prev === p ? 'none' : p))
    setEditing(null)
    setSelected(null)
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
        <div
          style={{
            padding: '16px 12px 12px',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}
        >
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
            const active = category === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
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
                {item.id === 'all' && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 400,
                    }}
                  >
                    {entries.length}
                  </span>
                )}
                {item.id === 'logins' && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      fontWeight: 400,
                    }}
                  >
                    {entries.length}
                  </span>
                )}
              </button>
            )
          })}

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
            <Plus size={12} color="var(--color-fg-quaternary)" />
          </div>
          {['Personal', 'Work', 'Shared'].map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                color: 'var(--color-text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <Folder size={14} color="var(--color-fg-quaternary)" />
              {c}
            </div>
          ))}
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
          {/* Accent & theme controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
            }}
          >
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

          {/* User profile */}
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
              RP
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                RokoPW Vault
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {settings.backend === 'remote' ? '☁ Remote sync' : '💾 Local'}
              </div>
            </div>
            <button
              onClick={() => openPanel('settings')}
              title="Settings"
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-fg-quaternary)',
                display: 'flex',
                padding: 2,
              }}
            >
              <Settings01 size={13} />
            </button>
            <button
              onClick={lock}
              title="Lock vault"
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-fg-quaternary)',
                display: 'flex',
                padding: 2,
              }}
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
        {/* List header */}
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
            <div style={{ fontSize: 15, fontWeight: 600 }}>All items</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
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
        </div>

        {/* Sort tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}
        >
          {['Recent', 'A–Z'].map((s, i) => (
            <span
              key={s}
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 999,
                background: i === 0 ? 'var(--color-bg-tertiary)' : 'transparent',
                color: i === 0 ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontWeight: i === 0 ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {s}
            </span>
          ))}
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
                  {entries.length > 0 ? 'No results found' : 'Your vault is empty'}
                </p>
                {entries.length === 0 && (
                  <p style={{ fontSize: 13, margin: 0 }}>Add your first credential to get started.</p>
                )}
              </div>
              {entries.length === 0 && (
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
                  <Plus size={14} /> Add credential
                </button>
              )}
            </div>
          ) : (
            filtered.map((entry) => {
              const isSelected = selected?.id === entry.id
              const favicon = entry.url
                ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(entry.url)}`
                : null
              const initials = entry.title.slice(0, 2).toUpperCase()
              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    setSelected(isSelected ? null : entry)
                    setPanel('none')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--color-border-secondary)',
                    background: isSelected ? 'var(--color-brand-50)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--color-bg-brand-solid)',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
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
                        width={20}
                        height={20}
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      initials
                    )}
                  </span>
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
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.username}
                    </div>
                  </div>
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
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--color-bg-primary)',
        }}
      >
        {panel === 'add' && (
          <RightPanel title="Add credential" onClose={closePanel}>
            <CredentialForm onSave={handleAdd} onCancel={closePanel} />
          </RightPanel>
        )}

        {panel === 'edit' && editing && (
          <RightPanel title="Edit credential" onClose={closePanel}>
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
            onEdit={openEdit}
            onDelete={handleDelete}
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
                Select a credential
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>
                Choose an item from the list to view its details.
              </p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 16 }}>
              {entries.length} credential{entries.length !== 1 ? 's' : ''} · encrypted with AES-256-GCM
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
  onEdit,
  onDelete,
  deleteConfirm,
}: {
  entry: VaultEntry
  onEdit: (e: VaultEntry) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
}) {
  const favicon = entry.url
    ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(entry.url)}`
    : null
  const initials = entry.title.slice(0, 2).toUpperCase()

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
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--color-bg-brand-solid)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" width={32} height={32} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
            {entry.title}
          </h2>
          {entry.url && (
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
          <button
            onClick={() => onDelete(entry.id)}
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
            {deleteConfirm === entry.id ? 'Confirm delete' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <FieldRow label="Username" value={entry.username} />
        <FieldRow label="Password" value={entry.password} secret />
        {entry.url && <FieldRow label="Website" value={entry.url} />}
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
          {entry.updatedAt !== entry.createdAt && (
            <span>Updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
          )}
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
  const [vaultIdInput, setVaultIdInput] = useState(settings.vaultId)
  const [saved, setSaved] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)

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
          {(['local', 'remote'] as const).map((b) => (
            <Button
              key={b}
              type="button"
              onClick={() => onApply({ backend: b })}
              color={settings.backend === b ? 'primary' : 'secondary'}
              size="sm"
              className="flex-1"
            >
              {b === 'local' ? '💾 Local' : '☁️ Remote'}
            </Button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
          {settings.backend === 'local'
            ? 'Vault is stored in this browser only.'
            : 'Encrypted vault blob is synced to the server. The server never sees your passwords.'}
        </p>
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
        <Button
          type="button"
          onClick={handleExport}
          isDisabled={exportLoading}
          isLoading={exportLoading}
          color="secondary"
          size="sm"
        >
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
        <Button
          type="button"
          onClick={handleSetupRecovery}
          isDisabled={recoveryLoading}
          isLoading={recoveryLoading}
          color="secondary"
          size="sm"
        >
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
