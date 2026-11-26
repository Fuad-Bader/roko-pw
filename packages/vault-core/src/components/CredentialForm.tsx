'use client'

import { useMemo, useRef, useState, type Dispatch, type SetStateAction, type FormEvent } from 'react'
import type { VaultEntry, EntryType, EntryDraft, SshAuth, VpnProtocol, CredentialTemplate, TemplateField } from '@roko/vault-core/lib/types'
import {
  DEFAULT_PORT,
  VPN_PROTOCOLS,
  inspectPrivateKey,
  isValidPort,
  publicKeyType,
  readTextFile,
  usesPreSharedKey,
  vpnProtocolMeta,
} from '@roko/vault-core/lib/infra'
import { Button } from '@roko/ui/components/base/buttons/button'
import { Eye, EyeOff, Upload01 } from '@untitledui/icons'
import { PasswordGenerator } from './PasswordGenerator'
import { ENTRY_TYPES, TYPE_ORDER } from './entryMeta'
import { TemplateGlyph } from './TemplateIcon'
import { builtinIdFor, customTemplatesOf, isBuiltin, isMultilineKind } from '@roko/vault-core/lib/templates'

interface Props {
  initial?: VaultEntry
  /** Item type to default to when adding (e.g. from the active category). */
  defaultType?: EntryType
  /** Custom templates available in this vault. */
  templates?: CredentialTemplate[]
  /** Custom template to preselect when adding. */
  defaultTemplateId?: string
  onSave: (data: EntryDraft) => Promise<void>
  onCancel: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

const monoAreaCls = `${inputCls} resize-y font-mono text-xs leading-relaxed`

const labelCls = 'mb-1 block text-xs font-medium text-tertiary'

/** Digits only, max 19 (longest PAN), grouped in blocks of 4 → "1234 5678 9012 3456". */
const formatCardNumber = (v: string) =>
  v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()

/** Digits only, max 4, with a slash after the month → "08/27". */
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`
}

/** Digits only, max 4 (Amex uses 4, everyone else 3). */
const formatCvv = (v: string) => v.replace(/\D/g, '').slice(0, 4)

const formatPort = (v: string) => v.replace(/\D/g, '').slice(0, 5)

export function CredentialForm({ initial, defaultType, templates = [], defaultTemplateId, onSave, onCancel }: Props) {
  const customTemplates = customTemplatesOf(templates)
  const startTemplate = customTemplates.find((t) => t.id === (initial?.templateId ?? defaultTemplateId))
  const [type, setType] = useState<EntryType>(
    initial?.type ?? (startTemplate ? (startTemplate.base === 'custom' ? 'custom' : startTemplate.base) : defaultType ?? 'login'),
  )
  const [templateId, setTemplateId] = useState<string | undefined>(initial?.templateId ?? startTemplate?.id)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initial?.fields ?? {})
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [cardNumber, setCardNumber] = useState(initial?.cardNumber ?? '')
  const [cardholder, setCardholder] = useState(initial?.cardholder ?? '')
  const [expiry, setExpiry] = useState(initial?.expiry ?? '')
  const [cvv, setCvv] = useState(initial?.cvv ?? '')
  // Infrastructure
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState(initial?.port ?? '')
  const [sshAuth, setSshAuth] = useState<SshAuth>(initial?.sshAuth ?? 'key')
  const [privateKey, setPrivateKey] = useState(initial?.privateKey ?? '')
  const [publicKey, setPublicKey] = useState(initial?.publicKey ?? '')
  const [passphrase, setPassphrase] = useState(initial?.passphrase ?? '')
  const [jumpHost, setJumpHost] = useState(initial?.jumpHost ?? '')
  const [domain, setDomain] = useState(initial?.domain ?? '')
  const [gateway, setGateway] = useState(initial?.gateway ?? '')
  const [vpnProtocol, setVpnProtocol] = useState<VpnProtocol>(initial?.vpnProtocol ?? 'wireguard')
  const [preSharedKey, setPreSharedKey] = useState(initial?.preSharedKey ?? '')
  const [config, setConfig] = useState(initial?.config ?? '')

  const [showPassword, setShowPassword] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!initial
  const meta = ENTRY_TYPES[type]
  // A custom template chosen for this item…
  const template = templateId ? templates.find((t) => t.id === templateId && !isBuiltin(t)) : undefined
  // …or, for a plain SSH / RDP / VPN item, the vault's customised built-in.
  const builtinOverride = (t: EntryType) =>
    t === 'ssh' || t === 'rdp' || t === 'vpn' ? templates.find((x) => x.id === builtinIdFor(t)) : undefined
  const fieldTemplate = template ?? (templateId ? undefined : builtinOverride(type))

  const chooseBuiltin = (t: EntryType) => {
    setType(t)
    setTemplateId(undefined)
  }
  const chooseTemplate = (t: CredentialTemplate) => {
    setType(t.base === 'custom' ? 'custom' : t.base)
    setTemplateId(t.id)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    if (type === 'custom' && !template) { setError('This item\'s template no longer exists.'); return }
    for (const f of fieldTemplate?.fields ?? []) {
      if (f.required && !(fieldValues[f.id] ?? '').trim()) { setError(`${f.label} is required.`); return }
    }
    if (type === 'login') {
      if (!username.trim()) { setError('Username is required.'); return }
      if (!password.trim()) { setError('Password is required.'); return }
    } else if (type === 'card') {
      if (!cardNumber.trim()) { setError('Card number is required.'); return }
    } else if (type === 'passkey') {
      if (!url.trim()) { setError('Relying party (website) is required.'); return }
    } else if (type === 'ssh') {
      if (!host.trim() && !privateKey.trim()) { setError('Add a host, a private key, or both.'); return }
      if (sshAuth === 'key' && host.trim() && !privateKey.trim()) { setError('Paste or load the private key, or switch to password auth.'); return }
      if (publicKey.trim() && !publicKeyType(publicKey)) { setError('Public key should look like "ssh-ed25519 AAAA… comment".'); return }
    } else if (type === 'rdp') {
      if (!host.trim()) { setError('Host is required.'); return }
    } else if (type === 'vpn') {
      if (!host.trim() && !config.trim()) { setError('Add a server address, a config file, or both.'); return }
    }
    if ((type === 'ssh' || type === 'rdp') && !isValidPort(port)) {
      setError('Port must be a number between 1 and 65535.')
      return
    }

    const base: EntryDraft = {
      type,
      title: title.trim(),
      url: url.trim(),
      username: username.trim(),
      password,
      notes: notes.trim(),
    }
    let extra: Partial<EntryDraft> = {}
    if (type === 'card') {
      extra = { cardNumber: cardNumber.trim(), cardholder: cardholder.trim(), expiry: expiry.trim(), cvv: cvv.trim() }
    } else if (type === 'ssh') {
      extra = {
        url: '',
        host: host.trim(),
        port: port.trim(),
        sshAuth,
        jumpHost: jumpHost.trim(),
        privateKey: sshAuth === 'key' ? normalizeKeyText(privateKey) : '',
        passphrase: sshAuth === 'key' ? passphrase : '',
        publicKey: publicKey.trim(),
        password: sshAuth === 'password' ? password : '',
      }
    } else if (type === 'rdp') {
      extra = { url: '', host: host.trim(), port: port.trim(), domain: domain.trim(), gateway: gateway.trim() }
    } else if (type === 'vpn') {
      extra = {
        url: '',
        host: host.trim(),
        vpnProtocol,
        preSharedKey: usesPreSharedKey(vpnProtocol) ? preSharedKey : '',
        config: normalizeKeyText(config),
      }
    }

    if (fieldTemplate) {
      // Values of fields later removed from the template stay on the item untouched.
      const fields: Record<string, string> = { ...(initial?.fields ?? {}) }
      for (const f of fieldTemplate.fields) {
        const v = fieldValues[f.id] ?? ''
        fields[f.id] = isMultilineKind(f.kind) ? v.replace(/\s+$/, '') : v.trim()
      }
      // Only custom templates are recorded on the item; built-in overrides apply by type.
      extra = { ...extra, ...(template ? { templateId: template.id } : {}), fields }
    }

    setSaving(true)
    try {
      await onSave({ ...base, ...extra })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const passwordProps = { password, setPassword, showPassword, setShowPassword, showGenerator, setShowGenerator }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector (only when creating) */}
      {!isEditing && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {TYPE_ORDER.slice(0, 3).map((id) => (
              <TypeButton key={id} id={id} override={builtinOverride(id)} active={type === id && !templateId} onSelect={chooseBuiltin} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {TYPE_ORDER.slice(3).map((id) => (
              <TypeButton key={id} id={id} override={builtinOverride(id)} active={type === id && !templateId} onSelect={chooseBuiltin} />
            ))}
          </div>
          {customTemplates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customTemplates.map((t) => {
                const active = templateId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseTemplate(t)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active ? 'border-border-brand bg-brand-primary text-brand-secondary' : 'border-border-primary bg-tertiary text-tertiary hover:border-border-brand'
                    }`}
                  >
                    <TemplateGlyph icon={t.icon} size={14} />
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {isEditing && template && (
        <p className="flex items-center gap-2 text-xs text-tertiary">
          <TemplateGlyph icon={template.icon} size={14} /> Template: <span className="font-semibold text-secondary">{template.name}</span>
        </p>
      )}

      <div>
        <label className={labelCls} htmlFor="cf-title">Title *</label>
        <input id="cf-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'custom' && template ? `e.g. ${template.name}` : meta.titlePlaceholder} autoFocus />
      </div>

      {/* ── Login fields ── */}
      {type === 'login' && (
        <>
          <div>
            <label className={labelCls} htmlFor="cf-url">Website URL</label>
            <input id="cf-url" className={inputCls} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-username">Username / Email *</label>
            <input id="cf-username" className={inputCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" />
          </div>
          <PasswordField {...passwordProps} />
        </>
      )}

      {/* ── SSH fields ── */}
      {type === 'ssh' && (
        <>
          <HostPortRow host={host} setHost={setHost} port={port} setPort={setPort} defaultPort={DEFAULT_PORT.ssh} hostPlaceholder="web01.example.com or 10.0.0.12" />
          <div>
            <label className={labelCls} htmlFor="cf-ssh-user">Username</label>
            <input id="cf-ssh-user" className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="deploy" />
          </div>
          <div>
            <span className={labelCls}>Authentication</span>
            <Segmented
              value={sshAuth}
              onChange={setSshAuth}
              options={[
                { id: 'key', label: 'Private key' },
                { id: 'password', label: 'Password' },
              ]}
            />
          </div>
          {sshAuth === 'key' ? (
            <>
              <PrivateKeyField privateKey={privateKey} setPrivateKey={setPrivateKey} publicKey={publicKey} setPublicKey={setPublicKey} />
              <SecretInput id="cf-passphrase" label="Key passphrase" value={passphrase} onChange={setPassphrase} placeholder="Leave empty if the key has none" />
              <div>
                <label className={labelCls} htmlFor="cf-pubkey">Public key</label>
                <textarea id="cf-pubkey" rows={2} spellCheck={false} className={monoAreaCls} value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="ssh-ed25519 AAAA… you@laptop" />
              </div>
            </>
          ) : (
            <PasswordField {...passwordProps} required={false} />
          )}
          <div>
            <label className={labelCls} htmlFor="cf-jump">Jump host</label>
            <input id="cf-jump" className={`${inputCls} font-mono`} spellCheck={false} value={jumpHost} onChange={(e) => setJumpHost(e.target.value)} placeholder="Optional, e.g. admin@bastion.example.com" />
          </div>
        </>
      )}

      {/* ── RDP fields ── */}
      {type === 'rdp' && (
        <>
          <HostPortRow host={host} setHost={setHost} port={port} setPort={setPort} defaultPort={DEFAULT_PORT.rdp} hostPlaceholder="dc01.corp.local" required />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="cf-rdp-domain">Domain</label>
              <input id="cf-rdp-domain" className={inputCls} autoComplete="off" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="CORP" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-rdp-user">Username</label>
              <input id="cf-rdp-user" className={inputCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jdoe" />
            </div>
          </div>
          <PasswordField {...passwordProps} required={false} />
          <div>
            <label className={labelCls} htmlFor="cf-rdp-gw">Remote Desktop Gateway</label>
            <input id="cf-rdp-gw" className={`${inputCls} font-mono`} spellCheck={false} value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="Optional, e.g. rdgw.corp.com" />
          </div>
        </>
      )}

      {/* ── VPN fields ── */}
      {type === 'vpn' && (
        <>
          <div>
            <label className={labelCls} htmlFor="cf-vpn-proto">Protocol</label>
            <select id="cf-vpn-proto" className={inputCls} value={vpnProtocol} onChange={(e) => setVpnProtocol(e.target.value as VpnProtocol)}>
              {VPN_PROTOCOLS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-vpn-host">Server</label>
            <input id="cf-vpn-host" className={`${inputCls} font-mono`} spellCheck={false} value={host} onChange={(e) => setHost(e.target.value)} placeholder="vpn.example.com:51820" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-vpn-user">Username</label>
            <input id="cf-vpn-user" className={inputCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={vpnProtocol === 'wireguard' ? 'Usually not needed for WireGuard' : 'jdoe'} />
          </div>
          <PasswordField {...passwordProps} required={false} />
          {usesPreSharedKey(vpnProtocol) && (
            <SecretInput id="cf-psk" label="Pre-shared key" value={preSharedKey} onChange={setPreSharedKey} placeholder="IPsec pre-shared key" />
          )}
          <TextFileField
            id="cf-vpn-config"
            label={vpnProtocolMeta(vpnProtocol).configLabel}
            value={config}
            onChange={setConfig}
            rows={6}
            accept=".conf,.ovpn,.txt,.cfg"
            placeholder={vpnProtocol === 'wireguard' ? '[Interface]\nPrivateKey = …\nAddress = 10.8.0.2/32\n\n[Peer]\nPublicKey = …\nEndpoint = vpn.example.com:51820' : 'Paste the client config, or load it from a file'}
          />
        </>
      )}

      {/* ── Card fields ── */}
      {type === 'card' && (
        <>
          <div>
            <label className={labelCls} htmlFor="cf-cardholder">Cardholder name</label>
            <input id="cf-cardholder" className={inputCls} value={cardholder} onChange={(e) => setCardholder(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-cardnumber">Card number *</label>
            <input id="cf-cardnumber" className={`${inputCls} font-mono`} inputMode="numeric" maxLength={23} value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="1234 5678 9012 3456" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="cf-expiry">Expiry (MM/YY)</label>
              <input id="cf-expiry" className={`${inputCls} font-mono`} inputMode="numeric" maxLength={5} value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="08/27" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cf-cvv">CVV</label>
              <input id="cf-cvv" className={`${inputCls} font-mono`} inputMode="numeric" maxLength={4} value={cvv} onChange={(e) => setCvv(formatCvv(e.target.value))} placeholder="123" />
            </div>
          </div>
        </>
      )}

      {/* ── Passkey fields ── */}
      {type === 'passkey' && (
        <>
          <div>
            <label className={labelCls} htmlFor="cf-rp">Relying party (website) *</label>
            <input id="cf-rp" className={inputCls} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div>
            <label className={labelCls} htmlFor="cf-pk-user">Username</label>
            <input id="cf-pk-user" className={inputCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" />
          </div>
          <p className="rounded-lg bg-tertiary px-3 py-2 text-xs text-tertiary">
            Stored as a reference. Creating & using passkeys on other sites needs the RokoPW browser extension.
          </p>
        </>
      )}

      {/* ── Template fields ── */}
      {fieldTemplate && fieldTemplate.fields.length > 0 && (
        <div className="space-y-4">
          {type !== 'custom' && <div className="border-t border-border-secondary pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">{fieldTemplate.name} fields</div>}
          {fieldTemplate.fields.map((f) => (
            <TemplateFieldInput key={f.id} field={f} value={fieldValues[f.id] ?? ''} onChange={(v) => setFieldValues((x) => ({ ...x, [f.id]: v }))} />
          ))}
        </div>
      )}

      <div>
        <label className={labelCls} htmlFor="cf-notes">Notes</label>
        <textarea
          id="cf-notes"
          rows={type === 'note' ? 5 : 2}
          className={inputCls}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={type === 'note' ? 'Your secure note (stored encrypted)' : 'Optional notes (stored encrypted)'}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" onClick={onCancel} color="secondary" size="sm" className="flex-1">
          Cancel
        </Button>
        <Button type="submit" isDisabled={saving} isLoading={saving} color="primary" size="sm" className="flex-1">
          {isEditing ? 'Update' : 'Add item'}
        </Button>
      </div>
    </form>
  )
}

/** Keep key/config text exact apart from CRLF → LF and surrounding blank lines; end with one newline. */
function normalizeKeyText(text: string): string {
  const t = text.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '')
  return t ? `${t}\n` : ''
}

function TypeButton({
  id,
  active,
  onSelect,
  override,
}: {
  id: EntryType
  active: boolean
  onSelect: (t: EntryType) => void
  /** The vault's customised version of this built-in template, if any. */
  override?: CredentialTemplate
}) {
  const { label: defaultLabel, icon: Icon } = ENTRY_TYPES[id]
  const label = override?.name ?? defaultLabel
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
        active
          ? 'border-border-brand bg-brand-primary text-brand-secondary'
          : 'border-border-primary bg-tertiary text-tertiary hover:border-border-brand'
      }`}
    >
      {override ? <TemplateGlyph icon={override.icon} size={16} /> : <Icon className="size-4" />}
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-full border border-border-primary bg-tertiary p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === o.id ? 'bg-primary text-primary shadow-xs' : 'text-tertiary hover:text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HostPortRow({
  host,
  setHost,
  port,
  setPort,
  defaultPort,
  hostPlaceholder,
  required,
}: {
  host: string
  setHost: (v: string) => void
  port: string
  setPort: (v: string) => void
  defaultPort: string
  hostPlaceholder: string
  required?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_88px] gap-3">
      <div>
        <label className={labelCls} htmlFor="cf-host">Host{required ? ' *' : ''}</label>
        <input id="cf-host" className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false} value={host} onChange={(e) => setHost(e.target.value)} placeholder={hostPlaceholder} />
      </div>
      <div>
        <label className={labelCls} htmlFor="cf-port">Port</label>
        <input id="cf-port" className={`${inputCls} font-mono`} inputMode="numeric" value={port} onChange={(e) => setPort(formatPort(e.target.value))} placeholder={defaultPort} />
      </div>
    </div>
  )
}

/** Masked single-line secret (passphrase, PSK) with a show/hide toggle. */
function SecretInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className={labelCls} htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`${inputCls} pr-10 font-mono`}
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary transition hover:text-primary"
          tabIndex={-1}
          aria-label={show ? 'Hide' : 'Show'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

/** Multi-line monospace field that can also be filled from a local file. */
function TextFileField({
  id,
  label,
  value,
  onChange,
  rows,
  accept,
  placeholder,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
  accept?: string
  placeholder?: string
  children?: React.ReactNode
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState('')

  const onFile = async (file: File | undefined) => {
    setFileError('')
    if (!file) return
    try {
      onChange(await readTextFile(file))
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={labelCls} htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 text-xs text-brand-secondary transition hover:text-brand-secondary_hover"
        >
          <Upload01 className="size-3.5" /> Load file
        </button>
        <input ref={fileRef} type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <textarea
        id={id}
        rows={rows}
        spellCheck={false}
        autoComplete="off"
        className={monoAreaCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {children}
      {fileError && <p className="mt-1 text-xs text-error-primary">{fileError}</p>}
    </div>
  )
}

function PrivateKeyField({
  privateKey,
  setPrivateKey,
  publicKey,
  setPublicKey,
}: {
  privateKey: string
  setPrivateKey: (v: string) => void
  publicKey: string
  setPublicKey: (v: string) => void
}) {
  const info = useMemo(() => (privateKey.trim() ? inspectPrivateKey(privateKey) : null), [privateKey])
  const derived = info?.publicKey ?? null
  const canDerive = !!derived && derived !== publicKey.trim().split(/\s+/).slice(0, 2).join(' ')

  return (
    <TextFileField
      id="cf-privkey"
      label="Private key"
      value={privateKey}
      onChange={setPrivateKey}
      rows={6}
      placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----'}
    >
      {info && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-tertiary">
          {info.format === 'unknown' ? (
            <span className="text-warning-primary">Unrecognised key format, saved as-is</span>
          ) : (
            <>
              <span>{info.algorithm ?? info.format.toUpperCase()}</span>
              {info.encrypted === true && <span className="text-success-primary">passphrase-protected</span>}
              {info.encrypted === false && <span className="text-warning-primary">no passphrase</span>}
            </>
          )}
          {canDerive && derived && (
            <button
              type="button"
              onClick={() => setPublicKey(derived)}
              className="ml-auto text-brand-secondary transition hover:text-brand-secondary_hover"
            >
              Fill public key from this key
            </button>
          )}
        </div>
      )}
    </TextFileField>
  )
}

function PasswordField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  showGenerator,
  setShowGenerator,
  required = true,
}: {
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  showGenerator: boolean
  setShowGenerator: Dispatch<SetStateAction<boolean>>
  required?: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={labelCls} htmlFor="cf-password" style={{ marginBottom: 0 }}>
          Password{required ? ' *' : ''}
        </label>
        <button
          type="button"
          onClick={() => setShowGenerator((v) => !v)}
          className="text-xs text-brand-secondary transition hover:text-brand-secondary_hover"
        >
          {showGenerator ? 'Hide generator' : 'Generate'}
        </button>
      </div>
      <div className="relative">
        <input
          id="cf-password"
          type={showPassword ? 'text' : 'password'}
          className={`${inputCls} pr-10`}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter or generate a password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary transition hover:text-primary"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showGenerator && (
        <div className="mt-2 rounded-lg border border-border-primary bg-tertiary p-3">
          <PasswordGenerator onSelect={(pw) => { setPassword(pw); setShowGenerator(() => false) }} />
        </div>
      )}
    </div>
  )
}

/** One input for a template field, chosen by the field's kind. */
function TemplateFieldInput({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  const id = `cf-tf-${field.id}`
  const label = `${field.label}${field.required ? ' *' : ''}`
  switch (field.kind) {
    case 'secret':
      return <SecretInput id={id} label={label} value={value} onChange={onChange} placeholder={field.placeholder} />
    case 'secretMultiline':
      return <TextFileField id={id} label={label} value={value} onChange={onChange} rows={5} placeholder={field.placeholder ?? 'Hidden after saving'} />
    case 'multiline':
      return (
        <div>
          <label className={labelCls} htmlFor={id}>{label}</label>
          <textarea id={id} rows={3} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </div>
      )
    default:
      return (
        <div>
          <label className={labelCls} htmlFor={id}>{label}</label>
          <input
            id={id}
            className={`${inputCls} ${field.kind === 'number' ? 'font-mono' : ''}`}
            type={field.kind === 'url' ? 'url' : field.kind === 'email' ? 'email' : 'text'}
            inputMode={field.kind === 'number' ? 'numeric' : undefined}
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(field.kind === 'number' ? e.target.value.replace(/[^\d.-]/g, '') : e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      )
  }
}
