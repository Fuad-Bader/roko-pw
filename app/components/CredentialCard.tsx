'use client'

import { useState } from 'react'
import type { VaultEntry } from '@/lib/types'

interface Props {
  entry: VaultEntry
  onEdit: (entry: VaultEntry) => void
  onDelete: (id: string) => void
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label}`}
      className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
    >
      {copied ? <span className="text-green-400">✓</span> : '📋'}
    </button>
  )
}

export function CredentialCard({ entry, onEdit, onDelete }: Props) {
  const [showPassword, setShowPassword] = useState(false)

  const favicon = entry.url
    ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(entry.url)}`
    : null

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={favicon}
              alt=""
              width={16}
              height={16}
              className="size-4 shrink-0 rounded"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <span className="text-base">🔑</span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{entry.title}</p>
            {entry.url && (
              <p className="truncate text-xs text-zinc-500">{entry.url}</p>
            )}
          </div>
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            title="Edit"
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            title="Delete"
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-red-900 hover:text-red-300"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Username row */}
      <div className="flex items-center gap-1">
        <span className="w-16 shrink-0 text-xs text-zinc-500">Username</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">
          {entry.username}
        </span>
        <CopyButton text={entry.username} label="username" />
      </div>

      {/* Password row */}
      <div className="mt-1 flex items-center gap-1">
        <span className="w-16 shrink-0 text-xs text-zinc-500">Password</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">
          {showPassword ? entry.password : '••••••••••••'}
        </span>
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          title={showPassword ? 'Hide password' : 'Show password'}
          className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
        >
          {showPassword ? '🙈' : '👁️'}
        </button>
        <CopyButton text={entry.password} label="password" />
      </div>

      {entry.notes && (
        <p className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{entry.notes}</p>
      )}
    </div>
  )
}
