'use client'

import { useMemo, useRef, useState } from 'react'
import type { CredentialTemplate, FieldKind, TemplateBase, TemplateIcon } from '@roko/vault-core/lib/types'
import {
  BASE_FIELDS,
  BUILTIN_TEMPLATES,
  FIELD_KINDS,
  blankTemplate,
  duplicateTemplate,
  isBuiltin,
  isSingleEmoji,
  newFieldId,
  svgFileToIcon,
  validateTemplate,
} from '@roko/vault-core/lib/templates'
import { Button } from '@roko/ui/components/base/buttons/button'
import { cx } from '@roko/ui/utils/cx'
import { ArrowDown, ArrowUp, Copy01, Edit03, Lock01, Plus, SearchMd, Trash01, Upload01 } from '@untitledui/icons'
import { useVault } from './VaultProvider'
import { ICON_KEYWORDS, ICON_LIBRARY, TemplateGlyph, TemplateTile } from './TemplateIcon'

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'
const labelCls = 'mb-1 block text-xs font-medium text-tertiary'
const sectionCls = 'font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary'

const BASE_LABEL: Record<TemplateBase, string> = { ssh: 'SSH', rdp: 'Remote desktop', vpn: 'VPN', custom: 'Blank' }

/** List of templates plus the editor. Lives in the dashboard's right-hand panel. */
export function TemplateManager({ onUse }: { onUse: (templateId: string) => void }) {
  const { templates, entries, saveTemplate, deleteTemplate, readOnly } = useVault()
  const [editing, setEditing] = useState<{ template: CredentialTemplate; isNew: boolean } | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const usage = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of entries) if (e.templateId && !e.deletedAt) m[e.templateId] = (m[e.templateId] ?? 0) + 1
    return m
  }, [entries])

  if (editing) {
    return (
      <TemplateEditor
        initial={editing.template}
        isNew={editing.isNew}
        others={templates.filter((t) => t.id !== editing.template.id)}
        onCancel={() => setEditing(null)}
        onSave={async (t) => {
          await saveTemplate(t)
          setEditing(null)
        }}
      />
    )
  }

  const remove = async (id: string) => {
    setError('')
    try {
      await deleteTemplate(id)
      setConfirmDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the template.')
      setConfirmDelete(null)
    }
  }

  const Row = ({ t }: { t: CredentialTemplate }) => {
    const builtin = isBuiltin(t)
    const count = builtin ? entries.filter((e) => e.type === t.base && !e.templateId && !e.deletedAt).length : usage[t.id] ?? 0
    return (
      <li className="flex items-center gap-3 py-3">
        <TemplateTile icon={t.icon} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{t.name}</span>
            {builtin ? (
              <span className="roko-tag gap-1 px-2 py-0 text-[10px]"><Lock01 className="size-2.5" /> Built in</span>
            ) : t.base !== 'custom' ? (
              <span className="roko-tag px-2 py-0 text-[10px]">Extends {BASE_LABEL[t.base]}</span>
            ) : null}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-tertiary">
            {builtin ? `${BASE_FIELDS[t.base as 'ssh'].length} fields` : `${(t.base !== 'custom' ? BASE_FIELDS[t.base].length : 0) + t.fields.length} fields`}
            {' · '}
            {count} item{count === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!readOnly && (
            <button type="button" onClick={() => onUse(t.id)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand-secondary hover:bg-primary_hover">
              Use
            </button>
          )}
          {!readOnly && (
            <IconBtn label={`Duplicate ${t.name}`} onClick={() => setEditing({ template: duplicateTemplate(t), isNew: true })}>
              <Copy01 className="size-4" />
            </IconBtn>
          )}
          {!builtin && !readOnly && (
            <>
              <IconBtn label={`Edit ${t.name}`} onClick={() => setEditing({ template: t, isNew: false })}>
                <Edit03 className="size-4" />
              </IconBtn>
              {confirmDelete === t.id ? (
                <button type="button" onClick={() => remove(t.id)} className="rounded-full bg-error-primary px-2.5 py-1 text-xs font-semibold text-error-primary">
                  Delete?
                </button>
              ) : (
                <IconBtn label={`Delete ${t.name}`} onClick={() => setConfirmDelete(t.id)} danger>
                  <Trash01 className="size-4" />
                </IconBtn>
              )}
            </>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-[13px] leading-relaxed text-tertiary">
        Templates decide which fields an item has. Duplicate a built-in template to add your own fields to SSH, RDP or VPN items,
        or start from scratch for anything else, like databases, API keys or certificates.
      </p>

      <section>
        <div className={`${sectionCls} mb-1`}>Built in</div>
        <ul className="divide-y divide-border-secondary">
          {BUILTIN_TEMPLATES.map((t) => <Row key={t.id} t={t} />)}
        </ul>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <span className={sectionCls}>Your templates</span>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-border-primary px-4 py-5 text-center text-[13px] text-tertiary">
            No custom templates yet.
          </p>
        ) : (
          <ul className="divide-y divide-border-secondary">
            {templates.map((t) => <Row key={t.id} t={t} />)}
          </ul>
        )}
      </section>

      {error && <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{error}</p>}

      {!readOnly && (
        <Button type="button" size="sm" iconLeading={Plus} className="w-full" onClick={() => setEditing({ template: blankTemplate(), isNew: true })}>
          New template
        </Button>
      )}
    </div>
  )
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-full text-fg-quaternary transition hover:bg-primary_hover ${danger ? 'hover:text-fg-error-primary' : 'hover:text-fg-secondary'}`}
    >
      {children}
    </button>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function TemplateEditor({
  initial,
  isNew,
  others,
  onSave,
  onCancel,
}: {
  initial: CredentialTemplate
  isNew: boolean
  others: CredentialTemplate[]
  onSave: (t: CredentialTemplate) => Promise<void>
  onCancel: () => void
}) {
  const [t, setT] = useState<CredentialTemplate>(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // The base can only be picked for a brand-new blank template (duplicates keep theirs).
  const canPickBase = isNew && initial.base === 'custom' && initial.name === ''

  const patch = (p: Partial<CredentialTemplate>) => setT((x) => ({ ...x, ...p }))
  const setField = (i: number, p: Partial<CredentialTemplate['fields'][number]>) =>
    setT((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) }))
  const move = (i: number, d: -1 | 1) =>
    setT((x) => {
      const f = [...x.fields]
      const j = i + d
      if (j < 0 || j >= f.length) return x
      ;[f[i], f[j]] = [f[j], f[i]]
      return { ...x, fields: f }
    })

  const save = async () => {
    const cleaned = { ...t, name: t.name.trim(), fields: t.fields.map((f) => ({ ...f, label: f.label.trim() })) }
    const problem = validateTemplate(cleaned, others)
    if (problem) return setError(problem)
    setSaving(true)
    try {
      await onSave(cleaned)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the template.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <TemplateTile icon={t.icon} size={44} />
        <div className="flex-1">
          <label className={labelCls} htmlFor="tpl-name">Template name *</label>
          <input id="tpl-name" className={inputCls} value={t.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. PostgreSQL database" autoFocus maxLength={60} />
        </div>
      </div>

      <IconPicker icon={t.icon} onChange={(icon) => patch({ icon })} />

      <div>
        <span className={labelCls}>Starts from</span>
        {canPickBase ? (
          <div className="grid grid-cols-4 gap-1 rounded-full border border-border-primary bg-tertiary p-1">
            {(['custom', 'ssh', 'rdp', 'vpn'] as TemplateBase[]).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={t.base === b}
                onClick={() => patch({ base: b, fields: b === 'custom' ? (t.fields.length ? t.fields : blankTemplate().fields) : [] })}
                className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${t.base === b ? 'bg-primary text-primary shadow-xs' : 'text-tertiary hover:text-secondary'}`}
              >
                {BASE_LABEL[b]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm">{t.base === 'custom' ? 'Blank template' : `${BASE_LABEL[t.base]} (built-in fields and actions kept)`}</p>
        )}
      </div>

      {t.base !== 'custom' && (
        <div>
          <div className={`${sectionCls} mb-2`}>Built-in fields</div>
          <div className="flex flex-wrap gap-1.5">
            {BASE_FIELDS[t.base].map((f) => (
              <span key={f} className="roko-tag gap-1"><Lock01 className="size-2.5" /> {f}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className={`${sectionCls} mb-2`}>{t.base === 'custom' ? 'Fields' : 'Extra fields'}</div>
        {t.fields.length === 0 && (
          <p className="mb-2 text-[13px] text-tertiary">No extra fields yet. Add things like an environment, owner team or ticket link.</p>
        )}
        <ul className="space-y-2">
          {t.fields.map((f, i) => (
            <li key={f.id} className="rounded-[12px] border border-border-secondary bg-secondary p-2.5">
              <div className="flex gap-2">
                <input
                  className={cx(inputCls, 'min-w-0 flex-1')}
                  value={f.label}
                  onChange={(e) => setField(i, { label: e.target.value })}
                  placeholder="Field label"
                  aria-label={`Field ${i + 1} label`}
                  maxLength={40}
                />
                <select
                  className={cx(inputCls, 'w-[136px] shrink-0')}
                  value={f.kind}
                  onChange={(e) => setField(i, { kind: e.target.value as FieldKind })}
                  aria-label={`Field ${i + 1} type`}
                  title={FIELD_KINDS.find((k) => k.id === f.kind)?.hint}
                >
                  {FIELD_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <label className="mr-auto flex items-center gap-2 text-xs text-secondary">
                  <input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} className="accent-brand-500" />
                  Required
                </label>
                <IconBtn label="Move up" onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></IconBtn>
                <IconBtn label="Move down" onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></IconBtn>
                <IconBtn label={`Remove ${f.label || 'field'}`} danger onClick={() => setT((x) => ({ ...x, fields: x.fields.filter((_, j) => j !== i) }))}>
                  <Trash01 className="size-3.5" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setT((x) => ({ ...x, fields: [...x.fields, { id: newFieldId(), label: '', kind: 'text', required: false }] }))}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-primary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:border-border-brand hover:text-brand-secondary"
        >
          <Plus className="size-3.5" /> Add field
        </button>
        {!isNew && (
          <p className="mt-2 text-xs text-tertiary">Removing a field hides it on existing items; their saved values are kept.</p>
        )}
      </div>

      {error && <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" color="secondary" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" className="flex-1" onClick={save} isLoading={saving} isDisabled={saving}>
          {isNew ? 'Create template' : 'Save template'}
        </Button>
      </div>
    </div>
  )
}

// ─── Icon picker ──────────────────────────────────────────────────────────────

function IconPicker({ icon, onChange }: { icon: TemplateIcon; onChange: (i: TemplateIcon) => void }) {
  const [tab, setTab] = useState<'library' | 'emoji' | 'upload'>(icon.kind === 'svg' ? 'upload' : icon.kind)
  const [query, setQuery] = useState('')
  const [emoji, setEmoji] = useState(icon.kind === 'emoji' ? icon.value : '')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const names = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.keys(ICON_LIBRARY).filter((n) => !q || n.toLowerCase().includes(q) || (ICON_KEYWORDS[n] ?? '').includes(q))
  }, [query])

  const onEmoji = (v: string) => {
    setEmoji(v)
    setError('')
    if (!v.trim()) return
    if (isSingleEmoji(v)) onChange({ kind: 'emoji', value: v.trim() })
    else setError('Enter a single emoji.')
  }

  const onFile = async (file?: File) => {
    setError('')
    if (!file) return
    try {
      onChange(await svgFileToIcon(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <span className={labelCls}>Icon</span>
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-full border border-border-primary bg-tertiary p-1">
        {(
          [
            ['library', 'Icon library'],
            ['emoji', 'Emoji'],
            ['upload', 'Upload SVG'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id)
              setError('')
            }}
            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${tab === id ? 'bg-primary text-primary shadow-xs' : 'text-tertiary hover:text-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <div className="rounded-[12px] border border-border-secondary bg-secondary p-2">
          <div className="relative mb-2">
            <SearchMd className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-quaternary" />
            <input className={cx(inputCls, 'pl-8')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: database, cloud, key…" aria-label="Search icons" />
          </div>
          <div className="flex max-h-[168px] flex-wrap gap-1 overflow-y-auto">
            {names.map((n) => {
              const active = icon.kind === 'library' && icon.name === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ kind: 'library', name: n })}
                  aria-label={n}
                  aria-pressed={active}
                  title={ICON_KEYWORDS[n] ?? n}
                  className={`grid size-9 place-items-center rounded-lg transition ${
                    active ? 'bg-[var(--ink-900)] text-[var(--ember-500)]' : 'text-fg-secondary hover:bg-primary_hover'
                  }`}
                >
                  <TemplateGlyph icon={{ kind: 'library', name: n }} size={18} />
                </button>
              )
            })}
            {names.length === 0 && <p className="w-full py-4 text-center text-xs text-tertiary">No icons match.</p>}
          </div>
        </div>
      )}

      {tab === 'emoji' && (
        <div className="flex items-center gap-3 rounded-[12px] border border-border-secondary bg-secondary p-3">
          <input
            className={cx(inputCls, 'w-20 text-center text-xl')}
            value={emoji}
            onChange={(e) => onEmoji(e.target.value)}
            placeholder="🐘"
            aria-label="Emoji"
            maxLength={16}
          />
          <p className="text-xs text-tertiary">Paste or type one emoji (on most systems: Win + . or Ctrl + Cmd + Space).</p>
        </div>
      )}

      {tab === 'upload' && (
        <div className="flex items-center gap-3 rounded-[12px] border border-border-secondary bg-secondary p-3">
          {icon.kind === 'svg' && <TemplateTile icon={icon} size={40} />}
          <div className="flex-1 text-xs text-tertiary">Square SVG, up to 24 KB. It is stored inside the vault and shown as an image.</div>
          <Button type="button" size="sm" color="secondary" iconLeading={Upload01} onClick={() => fileRef.current?.click()}>
            Choose SVG
          </Button>
          <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-error-primary">{error}</p>}
    </div>
  )
}
