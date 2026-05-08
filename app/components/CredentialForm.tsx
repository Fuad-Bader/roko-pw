'use client'

import { useState, type FormEvent } from 'react'
import type { VaultEntry } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'
import { PasswordGenerator } from './PasswordGenerator'

interface Props {
  initial?: VaultEntry
  onSave: (data: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

const labelCls = 'mb-1 block text-xs font-medium text-tertiary'

export function CredentialForm({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) { setError('Title is required.'); return }
    if (!username.trim()) { setError('Username is required.'); return }
    if (!password.trim()) { setError('Password is required.'); return }

    setSaving(true)
    try {
      await onSave({ title: title.trim(), url: url.trim(), username: username.trim(), password, notes: notes.trim() })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="cf-title">Title *</label>
        <input id="cf-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GitHub" autoFocus />
      </div>

      <div>
        <label className={labelCls} htmlFor="cf-url">Website URL</label>
        <input id="cf-url" className={inputCls} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" />
      </div>

      <div>
        <label className={labelCls} htmlFor="cf-username">Username / Email *</label>
        <input id="cf-username" className={inputCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" />
      </div>

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
            <PasswordGenerator onSelect={(pw) => { setPassword(pw); setShowGenerator(false) }} />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls} htmlFor="cf-notes">Notes</label>
        <textarea
          id="cf-notes"
          rows={2}
          className={inputCls}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes (stored encrypted)"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={onCancel}
          color="secondary"
          size="sm"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isDisabled={saving}
          isLoading={saving}
          color="primary"
          size="sm"
          className="flex-1"
        >
          {initial ? 'Update' : 'Add credential'}
        </Button>
      </div>
    </form>
  )
}
