'use client'

/**
 * Org admin console: vaults, people, permissions and the audit log.
 *
 * Granting access happens here, in the admin's browser: the admin's private key
 * unwraps the vault key, which is then wrapped for the member's public key. The
 * server only ever stores wrapped keys and ciphertext.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@roko/ui/components/base/buttons/button'
import { cx } from '@roko/ui/utils/cx'
import {
  Check,
  Clock,
  Edit03,
  Key01,
  Lock01,
  Plus,
  RefreshCw01,
  Trash01,
  UserPlus01,
  Users01,
  Activity,
  AlertTriangle,
  Download01,
  Eye,
  XClose,
  Settings01,
} from '@untitledui/icons'
import { useVault } from '@roko/vault-core/components/VaultProvider'
import { RokoLogo } from '@roko/ui/RokoLogo'
import * as api from '@roko/vault-core/lib/orgApi'
import type { AdminMember, AdminUser, AdminVault, AuditEvent, OrgSession, OrgSettings } from '@roko/vault-core/lib/orgApi'
import {
  decryptVaultV2,
  encryptVaultV2,
  generateVaultKey,
  keyFingerprint,
  unwrapVaultKey,
  wrapVaultKey,
  type EncryptedVaultV2,
} from '@roko/vault-core/lib/orgCrypto'
import { emptyVaultData, serializeVaultData } from '@roko/vault-core/lib/templates'
import { createOrgVault } from './orgActions'
import { MailStatus, SignupPolicy, Switch } from './controls'

type Tab = 'vaults' | 'people' | 'activity' | 'settings'

const inputCls =
  'w-full rounded-[10px] border border-border-primary bg-primary px-3 py-2 text-sm text-primary outline-none transition placeholder:text-placeholder focus:border-border-brand focus:ring-1 focus:ring-brand'

function errText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function when(ts: number | null) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'muted' | 'brand' | 'error'; children: React.ReactNode }) {
  const cls = {
    ok: 'bg-success-primary text-success-primary',
    warn: 'bg-warning-primary text-warning-primary',
    muted: 'bg-secondary text-tertiary border border-border-secondary',
    brand: 'bg-ember-a16 text-brand-secondary',
    error: 'bg-error-primary text-error-primary',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>
}

/** `headerActions` is rendered at the right of the header (lock, sign out, …). */
export function AdminConsole({ headerActions }: { headerActions?: ReactNode }) {
  const { org } = useVault()
  const session = org.session
  const privateKey = org.privateKey
  const me = org.me
  const [tab, setTab] = useState<Tab>('vaults')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [vaults, setVaults] = useState<AdminVault[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [orgName, setOrgName] = useState('')

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice((n) => (n === msg ? '' : n)), 4000)
  }

  const load = useCallback(async () => {
    if (!session) return
    setError('')
    try {
      const [u, v, settings] = await Promise.all([api.admin.users(session), api.admin.vaults(session), api.admin.settings(session)])
      setUsers(u)
      setVaults(v)
      setOrgName(settings.orgName)
      // Finish grants made before the user had keys (they have signed in since).
      if (privateKey) {
        let done = 0
        for (const vault of v) {
          if (!vault.pendingCount || !vault.myWrappedKey) continue
          const members = await api.admin.members(session, vault.id)
          const ready = members.filter((m) => m.pending && m.publicKey && m.status !== 'disabled')
          if (!ready.length) continue
          const key = await unwrapVaultKey(vault.myWrappedKey, privateKey)
          for (const m of ready) {
            await api.admin.setMember(session, vault.id, m.userId, { wrappedKey: await wrapVaultKey(key, m.publicKey!) })
            done++
          }
        }
        if (done) {
          flash(`Finished sharing ${done} pending vault access${done === 1 ? '' : 'es'}.`)
          setVaults(await api.admin.vaults(session))
        }
      }
    } catch (err) {
      setError(errText(err, 'Could not load the admin console.'))
    } finally {
      setLoading(false)
    }
  }, [session, privateKey])

  useEffect(() => {
    void load()
  }, [load])

  if (!session || !me || me.role !== 'admin') {
    return (
      <div className="grid min-h-screen place-items-center bg-primary p-6 text-center">
        <div>
          <p className="mb-4 text-sm text-tertiary">The admin console is only available to org admins.</p>
          {headerActions}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      {/* Header */}
      <header className="roko-blueprint roko-blueprint--flat border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-4 px-5">
          <RokoLogo size={28} tone="onDark" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ember-400)] sm:inline">Admin console</span>
          <span className="ml-auto hidden font-mono text-xs text-[var(--ink-300)] md:inline">
            {me.email} · {session.serverUrl.replace(/^https?:\/\//, '')}
          </span>
          <div className="flex items-center gap-2">{headerActions}</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="roko-eyebrow mb-3">{orgName || 'Organization'}</p>
            <h1 className="text-[30px] font-bold leading-tight">Manage access</h1>
          </div>
          <div className="flex gap-1 rounded-full border border-border-primary bg-primary p-1" role="tablist">
            {(
              [
                { id: 'vaults', label: 'Vaults', icon: Lock01, count: vaults.length },
                { id: 'people', label: 'People', icon: Users01, count: users.length },
                { id: 'activity', label: 'Activity', icon: Activity },
                { id: 'settings', label: 'Settings', icon: Settings01 },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  tab === t.id ? 'bg-[var(--ink-900)] text-[var(--paper)]' : 'text-tertiary hover:text-primary'
                }`}
              >
                <t.icon className="size-4" /> {t.label}
                {'count' in t && <span className="font-mono text-[11px] opacity-70">{t.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <p className="mb-4 flex items-center gap-2 rounded-[12px] bg-success-primary px-4 py-2.5 text-[13px] text-success-primary">
            <Check className="size-4" /> {notice}
          </p>
        )}
        {error && (
          <p className="mb-4 flex items-center gap-2 rounded-[12px] bg-error-primary px-4 py-2.5 text-[13px] text-error-primary">
            <AlertTriangle className="size-4" /> {error}
            <button type="button" className="ml-auto" onClick={() => setError('')} aria-label="Dismiss">
              <XClose className="size-4" />
            </button>
          </p>
        )}

        {loading ? (
          <div className="grid place-items-center py-24">
            <span className="size-8 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
          </div>
        ) : tab === 'vaults' ? (
          <VaultsTab session={session} privateKey={privateKey} meId={me.id} users={users} vaults={vaults} reload={load} setError={setError} flash={flash} />
        ) : tab === 'people' ? (
          <PeopleTab session={session} privateKey={privateKey} meId={me.id} users={users} vaults={vaults} reload={load} setError={setError} flash={flash} />
        ) : tab === 'activity' ? (
          <ActivityTab session={session} setError={setError} />
        ) : (
          <SettingsTab session={session} email={me.email} setError={setError} flash={flash} onOrgName={setOrgName} />
        )}
      </div>
    </div>
  )
}

interface TabProps {
  session: OrgSession
  privateKey: CryptoKey | null
  meId: string
  users: AdminUser[]
  vaults: AdminVault[]
  reload: () => Promise<void>
  setError: (e: string) => void
  flash: (m: string) => void
}

// ─── Vaults ───────────────────────────────────────────────────────────────────

function VaultsTab({ session, privateKey, meId, users, vaults, reload, setError, flash }: TabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(vaults[0]?.id ?? null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const selected = vaults.find((v) => v.id === selectedId) ?? null

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      // Admins hold the keys to every org vault.
      const id = await createOrgVault(session, newName.trim(), users)
      setNewName('')
      await reload()
      setSelectedId(id)
      flash(`Created "${newName.trim()}".`)
    } catch (err) {
      setError(errText(err, 'Could not create the vault.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3">
        <form onSubmit={create} className="flex gap-2 rounded-[22px] border border-border-secondary bg-primary p-3">
          <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New vault, e.g. Production" maxLength={100} />
          <Button type="submit" size="sm" iconLeading={Plus} isDisabled={!newName.trim() || creating} isLoading={creating}>
            Create
          </Button>
        </form>
        <div className="overflow-hidden rounded-[22px] border border-border-secondary bg-primary">
          {vaults.length === 0 && <p className="px-4 py-8 text-center text-sm text-tertiary">No vaults yet.</p>}
          {vaults.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className={`flex w-full items-center gap-3 border-b border-border-secondary px-4 py-3 text-left transition last:border-b-0 ${
                v.id === selectedId ? 'bg-ember-a12' : 'hover:bg-primary_hover'
              }`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--ink-900)] text-[var(--ember-500)]">
                <Lock01 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{v.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-tertiary">
                  {v.memberCount} member{v.memberCount === 1 ? '' : 's'}
                  {v.pendingCount > 0 && <Pill tone="warn"><Clock className="size-3" /> {v.pendingCount} pending</Pill>}
                  {v.kind === 'legacy' && <Pill tone="muted">Legacy</Pill>}
                  {!v.myWrappedKey && v.kind === 'org' && <Pill tone="error">No key</Pill>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <VaultDetail key={selected.id} vault={selected} session={session} privateKey={privateKey} meId={meId} users={users} reload={reload} setError={setError} flash={flash} onDeleted={() => setSelectedId(null)} />
      ) : (
        <div className="grid place-items-center rounded-[22px] border border-dashed border-border-primary p-10 text-sm text-tertiary">
          Select a vault to manage who can use it.
        </div>
      )}
    </div>
  )
}

function VaultDetail({
  vault,
  session,
  privateKey,
  meId,
  users,
  reload,
  setError,
  flash,
  onDeleted,
}: Omit<TabProps, 'vaults'> & { vault: AdminVault; onDeleted: () => void }) {
  const [members, setMembers] = useState<AdminMember[] | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(vault.name)
  const [busy, setBusy] = useState<string | null>(null)
  const [addUserId, setAddUserId] = useState('')
  const [addWrite, setAddWrite] = useState(true)
  const [addExport, setAddExport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const holdsKey = !!vault.myWrappedKey && !!privateKey
  const isLegacy = vault.kind === 'legacy'

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await api.admin.members(session, vault.id))
    } catch (err) {
      setError(errText(err, 'Could not load members.'))
    }
  }, [session, vault.id, setError])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const vaultKey = async () => {
    if (!vault.myWrappedKey || !privateKey) throw new Error("You don't hold this vault's key, so you can't share it.")
    return unwrapVaultKey(vault.myWrappedKey, privateKey)
  }

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    try {
      await fn()
    } catch (err) {
      setError(errText(err, 'That did not work.'))
    } finally {
      setBusy(null)
    }
  }

  const candidates = users.filter((u) => u.status !== 'disabled' && !members?.some((m) => m.userId === u.id))

  const addMember = () =>
    run('add', async () => {
      const u = users.find((x) => x.id === addUserId)
      if (!u) return
      const wrappedKey = u.publicKey ? await wrapVaultKey(await vaultKey(), u.publicKey) : undefined
      const res = await api.admin.setMember(session, vault.id, u.id, { canWrite: addWrite, canExport: addExport, wrappedKey })
      setAddUserId('')
      await Promise.all([loadMembers(), reload()])
      flash(res.pending ? `${u.email} will get access after their first sign-in.` : `${u.email} can now open "${vault.name}".`)
    })

  const setPerm = (m: AdminMember, patch: { canWrite?: boolean; canExport?: boolean }) =>
    run(m.userId, async () => {
      await api.admin.setMember(session, vault.id, m.userId, patch)
      await loadMembers()
    })

  /** Remove a member, then re-key the vault so a key they may have kept stops working. */
  const removeMember = (m: AdminMember) =>
    run(m.userId, async () => {
      await api.admin.removeMember(session, vault.id, m.userId)
      if (holdsKey && !isLegacy) {
        const remaining = (await api.admin.members(session, vault.id)).filter((x) => !x.pending && x.publicKey)
        const oldKey = await vaultKey()
        const current = await api.getVault(session, vault.id)
        const plain = current.blob ? await decryptVaultV2(oldKey, current.blob as EncryptedVaultV2) : serializeVaultData(emptyVaultData())
        const newKey = await generateVaultKey()
        const wrappedKeys: Record<string, string> = {}
        for (const r of remaining) wrappedKeys[r.userId] = await wrapVaultKey(newKey, r.publicKey!)
        await api.admin.rotate(session, vault.id, current.revision, await encryptVaultV2(newKey, plain), wrappedKeys)
        flash(`Removed ${m.email} and rotated the vault key.`)
      } else {
        flash(`Removed ${m.email}.`)
      }
      await Promise.all([loadMembers(), reload()])
    })

  const rename = (e: FormEvent) => {
    e.preventDefault()
    void run('rename', async () => {
      await api.admin.renameVault(session, vault.id, name)
      setRenaming(false)
      await reload()
    })
  }

  const remove = () =>
    run('delete', async () => {
      await api.admin.deleteVault(session, vault.id)
      onDeleted()
      await reload()
      flash(`Deleted "${vault.name}".`)
    })

  return (
    <div className="rounded-[22px] border border-border-secondary bg-primary">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-secondary px-5 py-4">
        {renaming ? (
          <form onSubmit={rename} className="flex flex-1 gap-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={100} />
            <Button type="submit" size="sm" isLoading={busy === 'rename'}>Save</Button>
            <Button type="button" size="sm" color="secondary" onClick={() => setRenaming(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <h2 className="text-xl font-bold">{vault.name}</h2>
            <button type="button" onClick={() => setRenaming(true)} className="text-fg-quaternary hover:text-fg-secondary" aria-label="Rename vault">
              <Edit03 className="size-4" />
            </button>
            <span className="ml-auto font-mono text-[11px] text-tertiary">rev {vault.revision} · updated {when(vault.updatedAt)}</span>
          </>
        )}
      </div>

      {isLegacy && (
        <p className="mx-5 mt-4 flex gap-2 rounded-[12px] bg-warning-primary px-4 py-3 text-[13px] text-warning-primary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Legacy vault: it still uses a shared vault password. A member who knows it can convert it from their vault list;
          after that you can manage access here.
        </p>
      )}
      {!isLegacy && !holdsKey && (
        <p className="mx-5 mt-4 flex gap-2 rounded-[12px] bg-warning-primary px-4 py-3 text-[13px] text-warning-primary">
          <Key01 className="mt-0.5 size-4 shrink-0" />
          You don&apos;t hold this vault&apos;s key yet, so you can change permissions but not add people. Another admin can share it with you.
        </p>
      )}

      {/* Members */}
      <div className="px-5 py-4">
        <div className="mb-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
          <span>Member</span>
          <span className="flex items-center gap-1"><Edit03 className="size-3" /> Edit</span>
          <span className="flex items-center gap-1"><Download01 className="size-3" /> Download</span>
          <span className="w-8" />
        </div>
        {members === null ? (
          <p className="py-6 text-center text-sm text-tertiary">Loading…</p>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-sm text-tertiary">Nobody has access yet.</p>
        ) : (
          <ul className="divide-y divide-border-secondary">
            {members.map((m) => (
              <li key={m.userId} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {m.email} {m.userId === meId && <span className="text-tertiary">(you)</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    {m.role === 'admin' && <Pill tone="brand">Admin</Pill>}
                    {m.pending && <Pill tone="warn"><Clock className="size-3" /> {m.publicKey ? 'Pending: reopen console' : 'Pending first sign-in'}</Pill>}
                    {m.status === 'disabled' && <Pill tone="error">Disabled</Pill>}
                    {!m.canWrite && !m.pending && <Pill tone="muted"><Eye className="size-3" /> View only</Pill>}
                  </span>
                </span>
                <Switch label={`Can edit: ${m.email}`} on={m.canWrite} disabled={busy !== null || isLegacy} onChange={(v) => setPerm(m, { canWrite: v })} />
                <Switch label={`Can download: ${m.email}`} on={m.canExport} disabled={busy !== null || isLegacy} onChange={(v) => setPerm(m, { canExport: v })} />
                <button
                  type="button"
                  onClick={() => removeMember(m)}
                  disabled={busy !== null || m.userId === meId}
                  className="grid size-8 place-items-center rounded-full text-fg-quaternary transition hover:bg-error-primary hover:text-fg-error-primary disabled:opacity-30"
                  aria-label={`Remove ${m.email}`}
                  title={m.userId === meId ? "You can't remove yourself" : 'Remove access'}
                >
                  {busy === m.userId ? <span className="size-3.5 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" /> : <Trash01 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add member */}
        {!isLegacy && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-border-secondary bg-secondary p-3">
            <select className={cx(inputCls, 'min-w-[200px] flex-1')} value={addUserId} onChange={(e) => setAddUserId(e.target.value)} disabled={!holdsKey}>
              <option value="">{candidates.length ? 'Add a person…' : 'Everyone already has access'}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                  {u.publicKey ? '' : ' (not signed in yet)'}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              <Switch label="Can edit" on={addWrite} onChange={setAddWrite} /> Edit
            </label>
            <label className="flex items-center gap-2 text-[13px] text-secondary">
              <Switch label="Can download" on={addExport} onChange={setAddExport} /> Download
            </label>
            <Button type="button" size="sm" iconLeading={UserPlus01} onClick={addMember} isDisabled={!addUserId || busy !== null || !holdsKey} isLoading={busy === 'add'}>
              Add
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-tertiary">
          Removing someone also rotates this vault&apos;s key, so a copy of the old key they may have kept stops working. Download
          permission controls the app&apos;s download button and is audited; anyone who can view an item can still copy what they see.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border-secondary px-5 py-3">
        {confirmDelete ? (
          <>
            <span className="mr-auto text-[13px] text-error-primary">Delete &quot;{vault.name}&quot; and everything in it for everyone?</span>
            <Button size="sm" color="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button size="sm" color="primary-destructive" onClick={remove} isLoading={busy === 'delete'}>Delete vault</Button>
          </>
        ) : (
          <Button size="sm" color="tertiary-destructive" iconLeading={Trash01} onClick={() => setConfirmDelete(true)}>Delete vault</Button>
        )}
      </div>
    </div>
  )
}

// ─── People ───────────────────────────────────────────────────────────────────

function Fingerprint({ publicKey }: { publicKey: string }) {
  const [fp, setFp] = useState('')
  useEffect(() => {
    let live = true
    keyFingerprint(publicKey).then((f) => live && setFp(f))
    return () => {
      live = false
    }
  }, [publicKey])
  return <span className="font-mono text-[11px] text-tertiary" title="Key fingerprint: compare it with the one the person sees in their settings">{fp.slice(0, 19)}</span>
}

function PeopleTab({ session, privateKey, meId, users, vaults, reload, setError, flash }: TabProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const sorted = useMemo(() => [...users].sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1)), [users])

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    try {
      await fn()
    } catch (err) {
      setError(errText(err, 'That did not work.'))
    } finally {
      setBusy(null)
    }
  }

  /** Admins hold every org vault key: share all keys this admin holds with a (new) admin. */
  const grantAllVaults = async (user: { id: string; publicKey: string | null }) => {
    for (const v of vaults) {
      if (v.kind !== 'org') continue
      const wrappedKey = user.publicKey && v.myWrappedKey && privateKey ? await wrapVaultKey(await unwrapVaultKey(v.myWrappedKey, privateKey), user.publicKey) : undefined
      if (!wrappedKey && user.publicKey) continue // can't share a key this admin doesn't hold
      await api.admin.setMember(session, v.id, user.id, { canWrite: true, canExport: true, wrappedKey })
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    void run('add', async () => {
      const res = await api.admin.addUser(session, email.trim(), role)
      if (role === 'admin') await grantAllVaults({ id: res.id, publicKey: null })
      flash(res.emailed ? `Added ${email.trim()} and emailed them sign-in instructions.` : `Added ${email.trim()}. The email could not be sent; share the server address with them.`)
      setEmail('')
      setRole('member')
      await reload()
    })
  }

  const setUserRole = (u: AdminUser, next: 'admin' | 'member') =>
    run(u.id, async () => {
      await api.admin.updateUser(session, u.id, { role: next })
      if (next === 'admin') await grantAllVaults(u)
      flash(next === 'admin' ? `${u.email} is now an admin and holds every vault key you hold.` : `${u.email} is now a member. Their vault access is unchanged.`)
      await reload()
    })

  const setStatus = (u: AdminUser, status: 'active' | 'disabled') =>
    run(u.id, async () => {
      await api.admin.updateUser(session, u.id, { status })
      flash(status === 'disabled' ? `${u.email} is disabled and signed out everywhere.` : `${u.email} can sign in again.`)
      await reload()
    })

  const removeUser = (u: AdminUser) =>
    run(u.id, async () => {
      await api.admin.removeUser(session, u.id)
      setConfirmRemove(null)
      flash(`Removed ${u.email}. Rotate the keys of vaults they could open from the Vaults tab if they may have kept a copy.`)
      await reload()
    })

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-[22px] border border-border-secondary bg-primary p-3">
        <input className={cx(inputCls, 'min-w-[240px] flex-1')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        <select className={cx(inputCls, 'w-auto')} value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button type="submit" size="sm" iconLeading={UserPlus01} isDisabled={!email.trim() || busy !== null} isLoading={busy === 'add'}>
          Add person
        </Button>
      </form>

      <div className="overflow-x-auto rounded-[22px] border border-border-secondary bg-primary">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border-secondary font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Keys</th>
              <th className="px-4 py-3 font-medium">Vaults</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-secondary">
            {sorted.map((u) => {
              const self = u.id === meId
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">
                    {u.email} {self && <span className="text-tertiary">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-full border border-border-primary bg-primary px-2.5 py-1 text-xs"
                      value={u.role}
                      disabled={self || busy !== null}
                      onChange={(e) => setUserRole(u, e.target.value as 'admin' | 'member')}
                      aria-label={`Role for ${u.email}`}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'active' ? <Pill tone="ok">Active</Pill> : u.status === 'invited' ? <Pill tone="warn">Invited</Pill> : <Pill tone="error">Disabled</Pill>}
                  </td>
                  <td className="px-4 py-3">{u.publicKey ? <Fingerprint publicKey={u.publicKey} /> : <span className="text-xs text-tertiary">Not set up</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.vaultCount}</td>
                  <td className="px-4 py-3 text-xs text-tertiary">{when(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {!self && (
                      <div className="flex justify-end gap-1.5">
                        {confirmRemove === u.id ? (
                          <>
                            <Button size="xs" color="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
                            <Button size="xs" color="primary-destructive" onClick={() => removeUser(u)} isLoading={busy === u.id}>Remove</Button>
                          </>
                        ) : (
                          <>
                            <Button size="xs" color="secondary" isDisabled={busy !== null} onClick={() => setStatus(u, u.status === 'disabled' ? 'active' : 'disabled')}>
                              {u.status === 'disabled' ? 'Enable' : 'Disable'}
                            </Button>
                            <Button size="xs" color="tertiary-destructive" isDisabled={busy !== null} onClick={() => setConfirmRemove(u.id)} aria-label={`Remove ${u.email}`}>
                              <Trash01 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed text-tertiary">
        People choose their own password at first sign-in; it never leaves their device, so admins can&apos;t see or reset it. If
        someone forgets it, remove and re-add them, then grant their vaults again.
      </p>
    </div>
  )
}

// ─── Activity ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'account.created': 'Created their account',
  'account.keys_created': 'Set up encryption keys',
  'auth.sign_in': 'Signed in',
  'user.added': 'Added a person',
  'user.updated': 'Changed a person',
  'user.removed': 'Removed a person',
  'vault.created': 'Created a vault',
  'vault.renamed': 'Renamed a vault',
  'vault.deleted': 'Deleted a vault',
  'vault.converted': 'Converted a legacy vault',
  'vault.key_rotated': 'Rotated a vault key',
  'vault.export': 'Downloaded a vault',
  'vault.export_denied': 'Tried to download a vault (denied)',
  'access.granted': 'Granted access',
  'access.updated': 'Changed access',
  'access.revoked': 'Removed access',
  'setup.started': 'Claimed the server and created the admin account',
  'setup.completed': 'Finished first-run setup',
  'settings.updated': 'Changed org settings',
}

function ActivityTab({ session, setError }: { session: OrgSession; setError: (e: string) => void }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let live = true
    api.admin
      .audit(session, 300)
      .then((e) => live && setEvents(e))
      .catch((err) => live && setError(errText(err, 'Could not load activity.')))
    return () => {
      live = false
    }
  }, [session, setError, reloadKey])
  const load = () => setReloadKey((k) => k + 1)

  const describe = (e: AuditEvent) => {
    const d = e.details ?? {}
    const bits: string[] = []
    if (typeof d.vault === 'string') bits.push(`"${d.vault}"`)
    if (typeof d.user === 'string') bits.push(d.user)
    if (e.action === 'user.added' || e.action === 'user.removed' || e.action === 'user.updated') bits.push(e.target ?? '')
    if (typeof d.role === 'string') bits.push(`role ${d.role}`)
    if (typeof d.status === 'string') bits.push(d.status)
    if (typeof d.canWrite === 'boolean') bits.push(d.canWrite ? 'can edit' : 'view only')
    if (typeof d.canExport === 'boolean') bits.push(d.canExport ? 'can download' : 'no download')
    if (d.pending) bits.push('pending')
    if (typeof d.to === 'string') bits.push(`to "${d.to}"`)
    return bits.filter(Boolean).join(' · ')
  }

  return (
    <div className="rounded-[22px] border border-border-secondary bg-primary">
      <div className="flex items-center justify-between border-b border-border-secondary px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Latest 300 events</span>
        <Button size="xs" color="secondary" iconLeading={RefreshCw01} onClick={() => void load()}>Refresh</Button>
      </div>
      {events === null ? (
        <p className="py-10 text-center text-sm text-tertiary">Loading…</p>
      ) : events.length === 0 ? (
        <p className="py-10 text-center text-sm text-tertiary">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border-secondary">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[150px_1fr] gap-4 px-5 py-2.5 text-sm max-sm:grid-cols-1 max-sm:gap-1">
              <span className="font-mono text-[11px] text-tertiary">{when(e.at)}</span>
              <span>
                <span className="font-medium">{e.actor ?? 'system'}</span>{' '}
                <span className={e.action === 'vault.export_denied' ? 'text-error-primary' : e.action === 'vault.export' ? 'text-brand-secondary' : 'text-secondary'}>
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                {describe(e) && <span className="text-tertiary"> · {describe(e)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsTab({
  session,
  email,
  setError,
  flash,
  onOrgName,
}: {
  session: OrgSession
  email: string
  setError: (e: string) => void
  flash: (m: string) => void
  onOrgName: (name: string) => void
}) {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.admin
      .settings(session)
      .then((s) => {
        setSettings(s)
        setName(s.orgName)
      })
      .catch((err) => setError(errText(err, 'Could not load settings.')))
  }, [session, setError])

  const update = async (patch: { orgName?: string; allowSignups?: boolean }, message: string) => {
    setSaving(true)
    try {
      const s = await api.admin.updateSettings(session, patch)
      setSettings(s)
      onOrgName(s.orgName)
      flash(message)
    } catch (err) {
      setError(errText(err, 'Could not save.'))
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div className="grid place-items-center py-24">
        <span className="size-8 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
      </div>
    )
  }

  const section = 'rounded-[16px] border border-border-secondary bg-primary p-5'
  return (
    <div className="grid max-w-[720px] gap-4">
      <form
        className={section}
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() && name.trim() !== settings.orgName) void update({ orgName: name.trim() }, 'Organization name saved.')
        }}
      >
        <h2 className="mb-1 text-[15px] font-semibold">Organization</h2>
        <p className="mb-4 text-[13px] text-tertiary">Shown to everyone who signs in to this server.</p>
        <label className="mb-1.5 block text-[13px] font-medium text-secondary" htmlFor="settings-org-name">
          Name
        </label>
        <div className="flex gap-2">
          <input id="settings-org-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" color="secondary" isDisabled={saving || !name.trim() || name.trim() === settings.orgName}>
            Save
          </Button>
        </div>
      </form>

      <section className={section}>
        <h2 className="mb-1 text-[15px] font-semibold">Who can create an account</h2>
        <p className="mb-4 text-[13px] text-tertiary">New accounts see no vaults until an admin shares one.</p>
        <SignupPolicy
          allowSignups={settings.allowSignups}
          locked={settings.allowSignupsLocked || saving}
          onChange={(v) => v !== settings.allowSignups && void update({ allowSignups: v }, v ? 'Anyone can now sign up.' : 'The server is invite-only.')}
        />
      </section>

      <section className={section}>
        <h2 className="mb-1 text-[15px] font-semibold">Email</h2>
        <p className="mb-4 text-[13px] text-tertiary">Sign-in codes and invitations are sent by email.</p>
        <MailStatus mail={settings.mail} email={email} onTest={async () => void (await api.admin.testEmail(session))} />
      </section>
    </div>
  )
}
