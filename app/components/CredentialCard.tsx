'use client'

import { useState } from 'react'
import type { VaultEntry } from '@/lib/types'
import { Eye, EyeOff, Copy01, Pencil01, Trash01 } from '@untitledui/icons'

interface Props {
  entry: VaultEntry
  onEdit: (entry: VaultEntry) => void
  onDelete: (id: string) => void
}

function CopyBtn({ text, label }: { text: string; label: string }) {
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
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: copied ? 'var(--color-brand-600)' : 'var(--color-fg-quaternary)',
        transition: 'color 0.1s, background 0.1s',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {copied ? '✓' : <Copy01 size={13} />}
    </button>
  )
}

export function CredentialCard({ entry, onEdit, onDelete }: Props) {
  const [showPassword, setShowPassword] = useState(false)

  const favicon = entry.url
    ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(entry.url)}`
    : null
  const initials = entry.title.slice(0, 2).toUpperCase()

  return (
    <div
      style={{
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 12,
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-primary)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px 0 rgba(16,24,40,.05)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-secondary)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 10px',
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--color-bg-brand-solid)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
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
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </p>
          {entry.url && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--color-text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.url}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onEdit(entry)}
            title="Edit"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-fg-quaternary)',
            }}
          >
            <Pencil01 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            title="Delete"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-bg-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-fg-error-primary)',
            }}
          >
            <Trash01 size={13} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-secondary)',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Username */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 56,
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Username
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--color-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {entry.username}
          </span>
          <CopyBtn text={entry.username} label="username" />
        </div>

        {/* Password */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 56,
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Password
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--color-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {showPassword ? entry.password : '••••••••••••'}
          </span>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? 'Hide' : 'Show'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-fg-quaternary)',
            }}
          >
            {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <CopyBtn text={entry.password} label="password" />
        </div>
      </div>

      {entry.notes && (
        <div
          style={{
            borderTop: '1px solid var(--color-border-secondary)',
            padding: '8px 16px 12px',
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            lineHeight: '18px',
          }}
        >
          {entry.notes}
        </div>
      )}
    </div>
  )
}
