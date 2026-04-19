'use client'

import { useCallback, useEffect, useState } from 'react'
import { generatePassword, passwordStrength } from '@/lib/crypto'
import type { PasswordOptions } from '@/lib/types'

const STRENGTH_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']

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
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
        <span className="flex-1 break-all font-mono text-sm text-white">{password}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-xs text-zinc-400 hover:text-white"
          title="Copy to clipboard"
        >
          {copied ? '✓' : '📋'}
        </button>
        <button
          type="button"
          onClick={regenerate}
          className="shrink-0 text-xs text-zinc-400 hover:text-white"
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
                i < strength.score ? STRENGTH_COLORS[strength.score - 1] : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500">{strength.label}</p>
      </div>

      {/* Length slider */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-zinc-400">
          <span>Length</span>
          <span className="font-mono text-white">{opts.length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={opts.length}
          onChange={(e) => setOpts((o) => ({ ...o, length: Number(e.target.value) }))}
          className="w-full accent-indigo-500"
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
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {onSelect && (
        <button
          type="button"
          onClick={() => onSelect(password)}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          Use this password
        </button>
      )}
    </div>
  )
}
