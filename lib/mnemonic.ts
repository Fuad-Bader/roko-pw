import { WORDLIST } from './wordlist'

const WORD_COUNT = 12

/**
 * Generate a cryptographically random 12-word recovery phrase.
 * Each word is picked from WORDLIST using an unbiased uint16 % WORDLIST.length selection.
 */
export function generateMnemonic(): string[] {
  const words: string[] = []
  // 2 bytes per word; 65536 / WORDLIST.length must be an integer for zero bias.
  const bytes = crypto.getRandomValues(new Uint8Array(WORD_COUNT * 2))
  for (let i = 0; i < WORD_COUNT; i++) {
    const uint16 = (bytes[i * 2] << 8) | bytes[i * 2 + 1]
    words.push(WORDLIST[uint16 % WORDLIST.length])
  }
  return words
}

/** Return true if every word in the phrase exists in the wordlist. */
export function validateMnemonic(words: string[]): boolean {
  if (words.length !== WORD_COUNT) return false
  const set = new Set(WORDLIST)
  return words.every((w) => set.has(w.toLowerCase().trim()))
}

/** Normalise a phrase (lowercase, trim, collapse whitespace). */
export function normaliseMnemonic(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter(Boolean)
}
