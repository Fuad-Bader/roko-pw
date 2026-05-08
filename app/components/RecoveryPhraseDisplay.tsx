'use client'

import { useState } from 'react'
import { Button } from '@/components/base/buttons/button'

interface Props {
  words: string[]
  onConfirmed: () => void
}

export function RecoveryPhraseDisplay({ words, onConfirmed }: Props) {
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  const phrase = words.join(' ')

  const copy = async () => {
    await navigator.clipboard.writeText(phrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const text = [
      'RokoPW Recovery Phrase',
      '======================',
      '',
      'Keep this file in a secure location (e.g. printed on paper or a USB drive).',
      'Anyone with these words can recover access to your vault.',
      '',
      ...words.map((w, i) => `${String(i + 1).padStart(2, ' ')}. ${w}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'roko-recovery-phrase.txt'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="rounded-xl border border-warning-solid/30 bg-warning-primary px-4 py-3">
        <p className="text-sm font-medium text-warning-primary">Save your recovery phrase</p>
        <p className="mt-1 text-xs leading-relaxed text-warning-primary/80">
          Write these 12 words down and store them somewhere safe — offline, on paper, or on a USB
          drive. They are the <strong>only way</strong> to recover your vault if you forget your
          master password. RokoPW cannot recover them for you.
        </p>
      </div>

      {/* Word grid */}
      <div className="grid grid-cols-3 gap-2">
        {words.map((word, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border-primary bg-tertiary px-3 py-2"
          >
            <span className="w-5 shrink-0 text-right text-xs font-mono text-quaternary">
              {i + 1}.
            </span>
            <span className="font-mono text-sm font-medium text-primary">{word}</span>
          </div>
        ))}
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={copy}
          color="secondary"
          size="sm"
          className="flex-1"
        >
          {copied ? '✓ Copied' : '📋 Copy phrase'}
        </Button>
        <Button
          type="button"
          onClick={download}
          color="secondary"
          size="sm"
          className="flex-1"
        >
          ⬇ Download .txt
        </Button>
      </div>

      {/* Confirmation */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-primary bg-tertiary p-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 accent-brand-500"
        />
        <span className="text-xs leading-relaxed text-tertiary">
          I have saved my recovery phrase in a secure location. I understand that losing it means
          permanent loss of access if I forget my master password.
        </span>
      </label>

      <Button
        type="button"
        onClick={onConfirmed}
        isDisabled={!confirmed}
        color="primary"
        size="md"
        className="w-full"
      >
        I&apos;ve saved it — continue
      </Button>
    </div>
  )
}
