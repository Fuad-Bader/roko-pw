'use client'

import { useState, type Dispatch, type SetStateAction, type FormEvent } from 'react'
import type { VaultEntry, EntryType, EntryDraft } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'
import { PasswordGenerator } from './PasswordGenerator'

interface Props {
  initial?: VaultEntry
  /** Item type to default to when adding (e.g. from the active category). */
  defaultType?: EntryType
  onSave: (data: EntryDraft) => Promise<void>
  onCancel: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

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

const TYPE_OPTIONS: { id: EntryType; label: string; icon: string }[] = [
  { id: 'login', label: 'Login', icon: '🔑' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'note', label: 'Note', icon: '📝' },
  { id: 'passkey', label: 'Passkey', icon: '🔐' },
]

export function CredentialForm({ initial, defaultType, onSave, onCancel }: Props) {
  const [type, setType] = useState<EntryType>(initial?.type ?? defaultType ?? 'login')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [cardNumber, setCardNumber] = useState(initial?.cardNumber ?? '')
  const [cardholder, setCardholder] = useState(initial?.cardholder ?? '')
  const [expiry, setExpiry] = useState(initial?.expiry ?? '')
  const [cvv, setCvv] = useState(initial?.cvv ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!initial

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    if (type === 'login') {
      if (!username.trim()) { setError('Username is required.'); return }
      if (!password.trim()) { setError('Password is required.'); return }
    } else if (type === 'card') {
      if (!cardNumber.trim()) { setError('Card number is required.'); return }
    } else if (type === 'passkey') {
      if (!url.trim()) { setError('Relying party (website) is required.'); return }
    }

    const draft: EntryDraft = {
      type,
      title: title.trim(),
      url: url.trim(),
      username: username.trim(),
      password,
      notes: notes.trim(),
      ...(type === 'card'
        ? {
            cardNumber: cardNumber.trim(),
            cardholder: cardholder.trim(),
            expiry: expiry.trim(),
            cvv: cvv.trim(),
          }
        : {}),
    }

    setSaving(true)
    try {
      await onSave(draft)
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector (only when creating) */}
      {!isEditing && (
        <div className="grid grid-cols-4 gap-1.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                  active
                    ? 'border-border-brand bg-brand-primary text-brand-secondary'
                    : 'border-border-primary bg-tertiary text-tertiary hover:border-border-brand'
                }`}
              >
                <span className="text-base leading-none">{opt.icon}</span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      <div>
        <label className={labelCls} htmlFor="cf-title">Title *</label>
        <input id="cf-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'card' ? 'e.g. Personal Visa' : type === 'note' ? 'e.g. WiFi password' : 'e.g. GitHub'} autoFocus />
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
          <PasswordField
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showGenerator={showGenerator}
            setShowGenerator={setShowGenerator}
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

function PasswordField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  showGenerator,
  setShowGenerator,
}: {
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  showGenerator: boolean
  setShowGenerator: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={labelCls} htmlFor="cf-password">Password *</label>
        <button
          type="button"
          onClick={() => setShowGenerator((v) => !v)}
          className="text-xs text-brand-400 hover:text-brand-300 transition"
        >
          {showGenerator ? 'Hide generator' : '✨ Generate'}
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
          className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary transition hover:text-primary"
          tabIndex={-1}
        >
          {showPassword ? '🙈' : '👁️'}
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
