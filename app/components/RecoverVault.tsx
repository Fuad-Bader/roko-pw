'use client'

import { useRef, useState, type FormEvent } from 'react'
import { normaliseMnemonic, validateMnemonic } from '@/lib/mnemonic'
import { useVault } from './VaultProvider'
import { Button } from '@/components/base/buttons/button'

const WORD_COUNT = 12

interface Props {
  onCancel: () => void
}

export function RecoverVault({ onCancel }: Props) {
  const { recoverWithPhrase, error, clearError } = useVault()
  const [inputs, setInputs] = useState<string[]>(Array(WORD_COUNT).fill(''))
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const setWord = (i: number, value: string) => {
    if (i === 0 && value.includes(' ')) {
      const words = normaliseMnemonic(value)
      if (words.length === WORD_COUNT) {
        setInputs(words)
        inputRefs.current[WORD_COUNT - 1]?.focus()
        return
      }
    }
    setInputs((prev) => {
      const next = [...prev]
      next[i] = value.toLowerCase().trim()
      return next
    })
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      inputRefs.current[Math.min(i + 1, WORD_COUNT - 1)]?.focus()
    }
    if (e.key === 'Backspace' && inputs[i] === '' && i > 0) {
      e.preventDefault()
      inputRefs.current[i - 1]?.focus()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError('')
    clearError()

    const words = inputs.map((w) => w.toLowerCase().trim())
    if (!validateMnemonic(words)) {
      setLocalError(
        'One or more words are not in the wordlist, or you have not entered all 12 words.',
      )
      return
    }

    setLoading(true)
    try {
      await recoverWithPhrase(words)
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-primary">Enter your recovery phrase</h3>
        <p className="mt-1 text-xs text-quaternary">
          Type your 12 words in order. You can also paste the full phrase into the first box.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {inputs.map((word, i) => (
            <div key={i} className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-quaternary">
                {i + 1}.
              </span>
              <input
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={word}
                onChange={(e) => setWord(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-full rounded-lg border border-border-primary bg-tertiary py-2 pl-7 pr-2 font-mono text-sm text-primary outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
          ))}
        </div>

        {displayError && (
          <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
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
            isDisabled={loading}
            isLoading={loading}
            color="primary"
            size="sm"
            className="flex-1"
          >
            Recover vault
          </Button>
        </div>
      </form>
    </div>
  )
}
