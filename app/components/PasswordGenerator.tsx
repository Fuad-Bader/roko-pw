'use client'

import { useCallback, useEffect, useState } from 'react'
import { generatePassword, passwordStrength } from '@/lib/crypto'
import type { PasswordOptions } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'

const STRENGTH_COLORS = [
  'bg-error-solid',
  'bg-warning-solid',
  'bg-warning-solid',
  'bg-brand-solid',
  'bg-success-solid',
]

interface Props {
  onSelect?: (pw: string) => void
}

export function PasswordGenerator({ onSelect }: Props) {
  const [opts, setOpts] = useState<PasswordOptions>({
    length: 20,
    upper: true,
    digits: true,
    symbols: true,
  })
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const regenerate = useCallback(() => {
    setPassword(generatePassword(opts))
    setCopied(false)
  }, [opts])

  useEffect(() => { regenerate() }, [regenerate])

  const strength = passwordStrength(password)

  const copy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {/* Generated password display */}
      <div className="flex items-center gap-2 rounded-lg border border-border-primary bg-tertiary px-3 py-2">
        <span className="flex-1 break-all font-mono text-sm text-primary">{password}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-xs text-tertiary transition hover:text-primary"
          title="Copy to clipboard"
        >
          {copied ? <span className="text-success-primary">✓</span> : '📋'}
        </button>
        <button
          type="button"
          onClick={regenerate}
          className="shrink-0 text-xs text-tertiary transition hover:text-primary"
          title="Regenerate"
        >
          🔄
        </button>
      </div>

      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < strength.score ? STRENGTH_COLORS[strength.score - 1] : 'bg-quaternary'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-quaternary">{strength.label}</p>
      </div>

      {/* Length slider */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-tertiary">
          <span>Length</span>
          <span className="font-mono text-primary">{opts.length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={opts.length}
          onChange={(e) => setOpts((o) => ({ ...o, length: Number(e.target.value) }))}
          className="w-full accent-brand-500"
        />
      </div>

      {/* Character class toggles */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'upper', label: 'A–Z' },
            { key: 'digits', label: '0–9' },
            { key: 'symbols', label: '!@#' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpts((o) => ({ ...o, [key]: !o[key] }))}
            className={`rounded px-2 py-0.5 text-xs font-medium transition ${
              opts[key]
                ? 'bg-brand-solid text-white'
                : 'bg-quaternary text-tertiary hover:bg-tertiary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onSelect && (
        <Button
          type="button"
          onClick={() => onSelect(password)}
          color="primary"
          size="sm"
          className="w-full"
        >
          Use this password
        </Button>
      )}
    </div>
  )
}
