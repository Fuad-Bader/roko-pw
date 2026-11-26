/**
 * Credential templates.
 *
 * SSH, RDP and VPN are built-in templates with fixed fields and special actions
 * (ssh command, .rdp file, config download). A vault can customise them: name,
 * icon and extra fields. The customisation is stored in the vault as a template
 * with the built-in id ("builtin:ssh"), an *override*; deleting it resets the
 * template to its default. Duplicating any template creates a custom template
 * with the same base. A template with base 'custom' is built from scratch.
 */
import type {
  Collection,
  CredentialTemplate,
  FieldKind,
  TemplateBase,
  TemplateField,
  TemplateIcon,
  VaultData,
  VaultEntry,
} from './types'

export const BUILTIN_PREFIX = 'builtin:'

export const BUILTIN_TEMPLATES: CredentialTemplate[] = [
  { id: 'builtin:ssh', name: 'SSH', icon: { kind: 'library', name: 'Terminal' }, base: 'ssh', fields: [], createdAt: 0, updatedAt: 0 },
  { id: 'builtin:rdp', name: 'Remote desktop', icon: { kind: 'library', name: 'Monitor01' }, base: 'rdp', fields: [], createdAt: 0, updatedAt: 0 },
  { id: 'builtin:vpn', name: 'VPN', icon: { kind: 'library', name: 'Shield01' }, base: 'vpn', fields: [], createdAt: 0, updatedAt: 0 },
]

export const isBuiltin = (t: Pick<CredentialTemplate, 'id'>) => t.id.startsWith(BUILTIN_PREFIX)

export const builtinIdFor = (base: Exclude<TemplateBase, 'custom'>) => `${BUILTIN_PREFIX}${base}`

/** The built-in templates as this vault sees them: defaults replaced by any saved override. */
export function effectiveBuiltins(vaultTemplates: CredentialTemplate[]): CredentialTemplate[] {
  return BUILTIN_TEMPLATES.map((d) => vaultTemplates.find((t) => t.id === d.id) ?? d)
}

/** User-made templates only (overrides of built-ins are excluded). */
export const customTemplatesOf = (vaultTemplates: CredentialTemplate[]) => vaultTemplates.filter((t) => !isBuiltin(t))

/** True when the vault has customised this built-in template. */
export const isOverridden = (vaultTemplates: CredentialTemplate[], id: string) => vaultTemplates.some((t) => t.id === id)

/**
 * The template that describes an item's extra fields: its own custom template,
 * or, for a plain SSH / RDP / VPN item, the vault's version of that built-in.
 */
export function templateForEntry(
  entry: Pick<VaultEntry, 'type' | 'templateId'>,
  vaultTemplates: CredentialTemplate[],
): CredentialTemplate | undefined {
  if (entry.templateId) return vaultTemplates.find((t) => t.id === entry.templateId)
  if (entry.type === 'ssh' || entry.type === 'rdp' || entry.type === 'vpn') {
    return vaultTemplates.find((t) => t.id === builtinIdFor(entry.type as 'ssh'))
  }
  return undefined
}

/** The fixed fields a built-in base provides, listed in the template editor. */
export const BASE_FIELDS: Record<Exclude<TemplateBase, 'custom'>, string[]> = {
  ssh: ['Host', 'Port', 'Username', 'Private key or password', 'Key passphrase', 'Public key', 'Jump host'],
  rdp: ['Host', 'Port', 'Domain', 'Username', 'Password', 'Remote Desktop Gateway'],
  vpn: ['Protocol', 'Server', 'Username', 'Password', 'Pre-shared key', 'Config file'],
}

export const FIELD_KINDS: { id: FieldKind; label: string; hint: string }[] = [
  { id: 'text', label: 'Text', hint: 'Single line, shown in plain text' },
  { id: 'secret', label: 'Secret', hint: 'Single line, hidden until revealed' },
  { id: 'multiline', label: 'Long text', hint: 'Several lines, shown in plain text' },
  { id: 'secretMultiline', label: 'Secret block', hint: 'Keys, certificates, tokens: hidden until revealed' },
  { id: 'url', label: 'URL', hint: 'A web address' },
  { id: 'email', label: 'Email', hint: 'An email address' },
  { id: 'number', label: 'Number', hint: 'Digits only' },
]

export const isSecretKind = (k: FieldKind) => k === 'secret' || k === 'secretMultiline'
export const isMultilineKind = (k: FieldKind) => k === 'multiline' || k === 'secretMultiline'

export function newFieldId(): string {
  return `f_${crypto.randomUUID().slice(0, 8)}`
}

export function blankTemplate(): CredentialTemplate {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: '',
    icon: { kind: 'library', name: 'Key01' },
    base: 'custom',
    fields: [
      { id: newFieldId(), label: 'Username', kind: 'text', required: false },
      { id: newFieldId(), label: 'Secret', kind: 'secret', required: false },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

/** A new, editable copy of any template (built-in or custom). */
export function duplicateTemplate(t: CredentialTemplate): CredentialTemplate {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    name: `${t.name} (copy)`,
    icon: t.icon,
    base: t.base,
    // Fresh ids so the copy's values never collide with the original's.
    fields: t.fields.map((f) => ({ ...f, id: newFieldId() })),
    createdAt: now,
    updatedAt: now,
  }
}

/** Returns an error message, or null when the template can be saved. */
export function validateTemplate(t: CredentialTemplate, others: CredentialTemplate[]): string | null {
  const name = t.name.trim()
  if (!name) return 'Give the template a name.'
  if (name.length > 60) return 'Keep the name under 60 characters.'
  const clash = [...effectiveBuiltins(others), ...customTemplatesOf(others)].find(
    (o) => o.id !== t.id && o.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (clash) return `A template called "${clash.name}" already exists.`
  if (t.base === 'custom' && t.fields.length === 0) return 'Add at least one field.'
  if (t.fields.length > 40) return 'A template can have at most 40 fields.'
  const labels = new Set<string>()
  for (const f of t.fields) {
    const label = f.label.trim()
    if (!label) return 'Every field needs a label.'
    if (labels.has(label.toLowerCase())) return `Two fields are called "${label}".`
    labels.add(label.toLowerCase())
  }
  return null
}

// ─── Icons ────────────────────────────────────────────────────────────────────

/** True when `value` is a single emoji (allowing modifiers, ZWJ sequences and flags). */
export function isSingleEmoji(value: string): boolean {
  const v = value.trim()
  if (!v || v.length > 16) return false
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  const graphemes = Segmenter ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(v)].length : 1
  return graphemes === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(v)
}

export const MAX_SVG_BYTES = 24 * 1024

/**
 * Turn an uploaded SVG file into a data URL for an icon.
 * Icons are only ever drawn through <img>, where SVG scripts and external
 * references don't run or load, so this checks shape and size rather than
 * trying to sanitise markup.
 */
export async function svgFileToIcon(file: File): Promise<TemplateIcon> {
  if (file.size > MAX_SVG_BYTES) throw new Error(`SVG must be under ${MAX_SVG_BYTES / 1024} KB.`)
  const text = (await file.text()).trim()
  const body = text.replace(/^<\?xml[^>]*>\s*/i, '').replace(/^<!--[\s\S]*?-->\s*/g, '').replace(/^<!DOCTYPE[^>]*>\s*/i, '')
  if (!/^<svg[\s>]/i.test(body) || !/<\/svg>\s*$/i.test(body)) throw new Error('That file is not an SVG image.')
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return { kind: 'svg', dataUrl: `data:image/svg+xml;base64,${btoa(bin)}` }
}

/** Only accept icons this app can render safely (guards data loaded from a vault). */
export function sanitizeIcon(icon: unknown): TemplateIcon {
  const fallback: TemplateIcon = { kind: 'library', name: 'Key01' }
  if (!icon || typeof icon !== 'object') return fallback
  const i = icon as Record<string, unknown>
  if (i.kind === 'library' && typeof i.name === 'string') return { kind: 'library', name: i.name }
  if (i.kind === 'emoji' && typeof i.value === 'string' && isSingleEmoji(i.value)) return { kind: 'emoji', value: i.value }
  if (i.kind === 'svg' && typeof i.dataUrl === 'string' && i.dataUrl.startsWith('data:image/svg+xml;base64,') && i.dataUrl.length < MAX_SVG_BYTES * 1.5) {
    return { kind: 'svg', dataUrl: i.dataUrl }
  }
  return fallback
}

// ─── Vault data (parse / normalise) ───────────────────────────────────────────

/** Fill in fields added after a vault was first written, so older entries load cleanly. */
export function normalizeEntry(e: Partial<VaultEntry> & { id: string }): VaultEntry {
  const now = Date.now()
  return {
    id: e.id,
    type: e.type ?? 'login',
    title: e.title ?? '',
    url: e.url ?? '',
    username: e.username ?? '',
    password: e.password ?? '',
    notes: e.notes ?? '',
    favorite: !!e.favorite,
    collectionId: e.collectionId ?? null,
    deletedAt: e.deletedAt ?? null,
    cardNumber: e.cardNumber,
    cardholder: e.cardholder,
    expiry: e.expiry,
    cvv: e.cvv,
    host: e.host,
    port: e.port,
    sshAuth: e.sshAuth,
    privateKey: e.privateKey,
    publicKey: e.publicKey,
    passphrase: e.passphrase,
    jumpHost: e.jumpHost,
    domain: e.domain,
    gateway: e.gateway,
    vpnProtocol: e.vpnProtocol,
    preSharedKey: e.preSharedKey,
    config: e.config,
    templateId: e.templateId,
    fields: e.fields && typeof e.fields === 'object' ? { ...e.fields } : undefined,
    createdAt: e.createdAt ?? now,
    updatedAt: e.updatedAt ?? now,
  }
}

function normalizeTemplate(t: Partial<CredentialTemplate> & { id: string }): CredentialTemplate {
  const base: TemplateBase = t.base === 'ssh' || t.base === 'rdp' || t.base === 'vpn' ? t.base : 'custom'
  const kinds = new Set(FIELD_KINDS.map((k) => k.id))
  return {
    id: t.id,
    name: String(t.name ?? 'Untitled'),
    icon: sanitizeIcon(t.icon),
    base,
    fields: (Array.isArray(t.fields) ? t.fields : [])
      .filter((f): f is TemplateField => !!f && typeof f.id === 'string')
      .map((f) => ({
        id: f.id,
        label: String(f.label ?? ''),
        kind: kinds.has(f.kind) ? f.kind : 'text',
        required: !!f.required,
        ...(f.placeholder ? { placeholder: String(f.placeholder) } : {}),
      })),
    createdAt: t.createdAt ?? 0,
    updatedAt: t.updatedAt ?? 0,
  }
}

/**
 * Decrypted payloads were originally a bare VaultEntry[], then { entries, collections };
 * templates were added later. Accept all shapes so existing vaults keep working.
 */
export function parseVaultData(json: string): VaultData {
  const raw = JSON.parse(json) as
    | Array<Partial<VaultEntry> & { id: string }>
    | {
        entries?: Array<Partial<VaultEntry> & { id: string }>
        collections?: Collection[]
        templates?: Array<Partial<CredentialTemplate> & { id: string }>
      }
  if (Array.isArray(raw)) return { entries: raw.map(normalizeEntry), collections: [], templates: [] }
  return {
    entries: (raw.entries ?? []).map(normalizeEntry),
    collections: raw.collections ?? [],
    templates: (raw.templates ?? [])
      .filter((t) => t && typeof t.id === 'string')
      .map(normalizeTemplate)
      // An override must keep its built-in's base (builtin:ssh is always an SSH template).
      .filter((t) => !isBuiltin(t) || BUILTIN_TEMPLATES.some((d) => d.id === t.id && d.base === t.base)),
  }
}

export function serializeVaultData(d: VaultData): string {
  return JSON.stringify({ entries: d.entries, collections: d.collections, templates: d.templates })
}

export function emptyVaultData(): VaultData {
  return { entries: [], collections: [], templates: [] }
}

// ─── Three-way merge (org vaults edited by several people) ────────────────────

type HasId = { id: string }

/**
 * Merge `local` and `remote` edits made since `base`.
 * - added on either side: kept
 * - changed on one side: that side wins
 * - changed on both: the newer `stamp` wins (ties go to local)
 * - deleted on one side and untouched on the other: deleted
 * - deleted on one side but changed on the other: the change is kept (never lose edits)
 */
export function merge3<T extends HasId>(base: T[], local: T[], remote: T[], stamp: (t: T) => number = () => 0): T[] {
  const B = new Map(base.map((x) => [x.id, x]))
  const L = new Map(local.map((x) => [x.id, x]))
  const R = new Map(remote.map((x) => [x.id, x]))
  const same = (a: T | undefined, b: T | undefined) => JSON.stringify(a) === JSON.stringify(b)
  const out = new Map<string, T>()
  const ids = new Set([...B.keys(), ...L.keys(), ...R.keys()])
  for (const id of ids) {
    const b = B.get(id), l = L.get(id), r = R.get(id)
    const lChanged = !same(b, l)
    const rChanged = !same(b, r)
    let pick: T | undefined
    if (!lChanged) pick = r
    else if (!rChanged) pick = l
    else if (l && r) pick = stamp(r) > stamp(l) ? r : l
    else pick = l ?? r // one side deleted, the other edited: keep the edit
    if (pick) out.set(id, pick)
  }
  // Keep remote order, then anything new locally.
  const order = [...remote.map((x) => x.id), ...local.map((x) => x.id)]
  const seen = new Set<string>()
  const result: T[] = []
  for (const id of order) {
    if (seen.has(id) || !out.has(id)) continue
    seen.add(id)
    result.push(out.get(id)!)
  }
  return result
}

export function mergeVaultData(base: VaultData, local: VaultData, remote: VaultData): VaultData {
  return {
    entries: merge3(base.entries, local.entries, remote.entries, (e) => e.updatedAt),
    collections: merge3(base.collections, local.collections, remote.collections, (c) => c.createdAt),
    templates: merge3(base.templates, local.templates, remote.templates, (t) => t.updatedAt),
  }
}
