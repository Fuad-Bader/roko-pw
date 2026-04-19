import type { PasswordOptions } from './types'

// 600,000 iterations per OWASP 2023 recommendation for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 600_000

function ab2b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function b642ab(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

/** Generate a cryptographically random 32-byte salt, returned as base64. */
export function randomSalt(): string {
  return ab2b64(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer)
}

/**
 * Derive an AES-256-GCM key from a master password and salt using PBKDF2-SHA256.
 * The key is extractable so it can be exported for the browser extension if needed.
 */
export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b642ab(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

/** Export a CryptoKey as a base64-encoded raw key (for extension handoff). */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return ab2b64(raw)
}

/** Import a previously exported raw AES key. */
export async function importRawKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b642ab(b64), { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

/** Encrypt plaintext with AES-256-GCM. Returns base64-encoded IV and ciphertext. */
export async function encryptData(
  key: CryptoKey,
  plaintext: string,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    iv: ab2b64(iv.buffer as ArrayBuffer),
    ciphertext: ab2b64(ciphertext),
  }
}

/** Decrypt AES-256-GCM ciphertext. Throws DOMException on wrong key/tampered data. */
export async function decryptData(
  key: CryptoKey,
  ivB64: string,
  ciphertextB64: string,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b642ab(ivB64) },
    key,
    b642ab(ciphertextB64),
  )
  return new TextDecoder().decode(plaintext)
}

const CHARS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
}

/**
 * Generate a cryptographically random password.
 * Guarantees at least one character from each enabled class.
 */
export function generatePassword(opts: PasswordOptions): string {
  const { length, upper, digits, symbols } = opts

  let alphabet = CHARS.lower
  if (upper) alphabet += CHARS.upper
  if (digits) alphabet += CHARS.digits
  if (symbols) alphabet += CHARS.symbols

  // Pick at least one char from each required class
  const required: string[] = []
  const pick = (set: string) => set[crypto.getRandomValues(new Uint8Array(1))[0] % set.length]
  required.push(pick(CHARS.lower))
  if (upper) required.push(pick(CHARS.upper))
  if (digits) required.push(pick(CHARS.digits))
  if (symbols) required.push(pick(CHARS.symbols))

  const fillCount = Math.max(0, length - required.length)
  const fillBytes = crypto.getRandomValues(new Uint8Array(fillCount))
  const result = [...required, ...Array.from(fillBytes, (b) => alphabet[b % alphabet.length])]

  // Fisher-Yates shuffle with fresh random bytes
  const shuffleBytes = crypto.getRandomValues(new Uint8Array(result.length))
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result.join('')
}

/** Simple strength score 0–4. */
export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 16) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] ?? 'Strong' }
}
