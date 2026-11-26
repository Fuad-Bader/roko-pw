/**
 * Cryptography for org (server) vaults. Everything runs in the browser.
 *
 *  password ──PBKDF2 600k (salt: email)──▶ account key
 *    account key ──PBKDF2 1 round (salt: password)──▶ authHash   (sent to the server; it stores scrypt(authHash))
 *    account key ──HKDF──▶ private-key encryption key           (never leaves the device)
 *
 *  Each user has an RSA-OAEP 3072 key pair. The private key is stored on the
 *  server encrypted with the private-key encryption key.
 *
 *  Each org vault has a random AES-256-GCM vault key. The server stores it once
 *  per member, wrapped (RSA-OAEP) to that member's public key. Vault contents
 *  are encrypted with the vault key, so the server never sees plaintext or keys.
 */

const PBKDF2_ITERATIONS = 600_000
const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 3072,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}
const enc = new TextEncoder()

// ─── base64 ───────────────────────────────────────────────────────────────────

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ─── Account (password-derived) keys ──────────────────────────────────────────

export interface AccountSecrets {
  /** Proof of password the server can verify; reveals nothing usable about the password. */
  authHash: string
  /** Encrypts / decrypts this user's private key. Non-extractable. */
  privateKeyEncKey: CryptoKey
}

export async function deriveAccountSecrets(email: string, password: string): Promise<AccountSecrets> {
  const salt = enc.encode(`roko-pw/account/v1/${email.trim().toLowerCase()}`)
  const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const accountBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    pwKey,
    256,
  )

  const accountForAuth = await crypto.subtle.importKey('raw', accountBits, 'PBKDF2', false, ['deriveBits'])
  const authBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(password), iterations: 1, hash: 'SHA-256' },
    accountForAuth,
    256,
  )

  const accountForEnc = await crypto.subtle.importKey('raw', accountBits, 'HKDF', false, ['deriveKey'])
  const privateKeyEncKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('roko-pw/private-key/v1') },
    accountForEnc,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { authHash: toB64(authBits), privateKeyEncKey }
}

// ─── User key pair ────────────────────────────────────────────────────────────

export interface EncryptedPrivateKey {
  iv: string
  ciphertext: string
}

export interface NewUserKeys {
  publicKey: string // SPKI, base64
  encryptedPrivateKey: EncryptedPrivateKey
  privateKey: CryptoKey
}

export async function generateUserKeys(privateKeyEncKey: CryptoKey): Promise<NewUserKeys> {
  const pair = await crypto.subtle.generateKey(RSA_PARAMS, true, ['wrapKey', 'unwrapKey'])
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, privateKeyEncKey, pkcs8)
  return {
    publicKey: toB64(spki),
    encryptedPrivateKey: { iv: toB64(iv), ciphertext: toB64(ciphertext) },
    privateKey: await importPrivateKey(pkcs8),
  }
}

function importPrivateKey(pkcs8: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  // Non-extractable once imported: the plaintext private key never leaves WebCrypto again.
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey'])
}

/** Decrypt the user's private key. Throws if the password (and so the key) is wrong. */
export async function unlockPrivateKey(privateKeyEncKey: CryptoKey, epk: EncryptedPrivateKey): Promise<CryptoKey> {
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(epk.iv) }, privateKeyEncKey, fromB64(epk.ciphertext))
  return importPrivateKey(pkcs8)
}

export function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', fromB64(spkiB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey'])
}

/** Short, human-comparable fingerprint of a public key, e.g. "3F2A 91C0 …". */
export async function keyFingerprint(spkiB64: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fromB64(spkiB64)))
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return hex.match(/.{4}/g)!.join(' ')
}

// ─── Vault keys ───────────────────────────────────────────────────────────────

/** Extractable so it can be wrapped for other members. */
export function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function wrapVaultKey(vaultKey: CryptoKey, publicKeySpkiB64: string): Promise<string> {
  const pub = await importPublicKey(publicKeySpkiB64)
  return toB64(await crypto.subtle.wrapKey('raw', vaultKey, pub, { name: 'RSA-OAEP' }))
}

export function unwrapVaultKey(wrappedB64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    fromB64(wrappedB64),
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true, // admins re-wrap it for other members
    ['encrypt', 'decrypt'],
  )
}

// ─── Vault blobs (version 2) ──────────────────────────────────────────────────

export interface EncryptedVaultV2 {
  version: 2
  iv: string
  ciphertext: string
}

export async function encryptVaultV2(vaultKey: CryptoKey, plaintext: string): Promise<EncryptedVaultV2> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, enc.encode(plaintext))
  return { version: 2, iv: toB64(iv), ciphertext: toB64(ct) }
}

export async function decryptVaultV2(vaultKey: CryptoKey, blob: EncryptedVaultV2): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, vaultKey, fromB64(blob.ciphertext))
  return new TextDecoder().decode(pt)
}
