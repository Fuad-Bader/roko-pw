/**
 * Shared crypto utilities for the Roko browser extension.
 * Mirrors lib/crypto.ts — uses only the Web Crypto API (no external deps).
 */

const PBKDF2_ITERATIONS = 600_000

function ab2b64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function b642ab(b64) {
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

export function randomSalt() {
  return ab2b64(crypto.getRandomValues(new Uint8Array(32)).buffer)
}

export async function deriveKey(password, saltB64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b642ab(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptData(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return { iv: ab2b64(iv.buffer), ciphertext: ab2b64(ciphertext) }
}

export async function decryptData(key, ivB64, ciphertextB64) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b642ab(ivB64) },
    key,
    b642ab(ciphertextB64),
  )
  return new TextDecoder().decode(plaintext)
}

export async function exportKey(key) {
  return ab2b64(await crypto.subtle.exportKey('raw', key))
}

export async function importRawKey(b64) {
  return crypto.subtle.importKey('raw', b642ab(b64), { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

export function generatePassword({ length = 20, upper = true, digits = true, symbols = true } = {}) {
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digitChars = '0123456789'
  const symbolChars = '!@#$%^&*()-_=+[]{}|;:,.<>?'

  let alphabet = lower
  if (upper) alphabet += upperChars
  if (digits) alphabet += digitChars
  if (symbols) alphabet += symbolChars

  const pick = (set) => set[crypto.getRandomValues(new Uint8Array(1))[0] % set.length]
  const required = [pick(lower)]
  if (upper) required.push(pick(upperChars))
  if (digits) required.push(pick(digitChars))
  if (symbols) required.push(pick(symbolChars))

  const fillCount = Math.max(0, length - required.length)
  const fillBytes = crypto.getRandomValues(new Uint8Array(fillCount))
  const result = [...required, ...Array.from(fillBytes, (b) => alphabet[b % alphabet.length])]

  const shuffleBytes = crypto.getRandomValues(new Uint8Array(result.length))
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result.join('')
}
