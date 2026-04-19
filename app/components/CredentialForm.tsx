'use client'

import { useState, type FormEvent } from 'react'
import type { VaultEntry } from '@/lib/types'
import { PasswordGenerator } from './PasswordGenerator'

interface Props {
  initial?: VaultEntry
  onSave: (data: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onCancel: () => void
}

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

  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
  const labelClass = 'mb-1 block text-xs font-medium text-zinc-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="cf-title">Title *</label>
        <input id="cf-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GitHub" autoFocus />
      </div>

      <div>
        <label className={labelClass} htmlFor="cf-url">Website URL</label>
        <input id="cf-url" className={inputClass} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com" />
      </div>

      <div>
        <label className={labelClass} htmlFor="cf-username">Username / Email *</label>
        <input id="cf-username" className={inputClass} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelClass} htmlFor="cf-password">Password *</label>
          <button
            type="button"
            onClick={() => setShowGenerator((v) => !v)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {showGenerator ? 'Hide generator' : '✨ Generate'}
          </button>
        </div>
        <div className="relative">
          <input
            id="cf-password"
            type={showPassword ? 'text' : 'password'}
            className={`${inputClass} pr-10`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter or generate a password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            tabIndex={-1}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        {showGenerator && (
          <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
            <PasswordGenerator onSelect={(pw) => { setPassword(pw); setShowGenerator(false) }} />
          </div>
        )}
      </div>

      <div>
        <label className={labelClass} htmlFor="cf-notes">Notes</label>
        <textarea
          id="cf-notes"
          rows={2}
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes (stored encrypted)"
        />
      </div>

      {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update' : 'Add credential'}
        </button>
      </div>
    </form>
  )
}
