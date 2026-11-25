'use client'

import { useState } from 'react'
import { Check, Copy01, Eye, EyeOff } from '@untitledui/icons'

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 10px/1.4 var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>
      {children}
    </div>
  )
}

/** A labelled single-line value with copy (and reveal, for secrets). */
export function FieldRow({ label, value, secret, mono }: { label: string; value: string; secret?: boolean; mono?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 10,
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: secret || mono ? 'var(--font-mono)' : 'inherit',
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
          {copied ? <Check size={14} /> : <Copy01 size={14} />}
        </button>
      </div>
    </div>
  )
}
