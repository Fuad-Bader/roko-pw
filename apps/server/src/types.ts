// Mirrors the client-side vault shapes. The server only validates structure,
// never decrypts.

/** Legacy vault: encrypted with a key derived from a shared vault password. */
export interface EncryptedVault {
  version: 1
  salt: string
  iv: string
  ciphertext: string
  recovery?: {
    salt: string
    iv: string
    wrappedKey: string
  }
}

/** Org vault: encrypted with a random vault key that is wrapped per member. */
export interface EncryptedVaultV2 {
  version: 2
  iv: string
  ciphertext: string
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/
/** Upper bound for one vault blob (about 20 MB of base64). */
export const MAX_BLOB_CHARS = 20 * 1024 * 1024

export function isB64(v: unknown, maxLen = MAX_BLOB_CHARS): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen && B64.test(v)
}

export function isVaultV2(v: unknown): v is EncryptedVaultV2 {
  const b = v as EncryptedVaultV2 | null
  return !!b && b.version === 2 && isB64(b.iv, 64) && isB64(b.ciphertext)
}

/** A vault key wrapped with RSA-OAEP (base64, ~512 chars for a 3072-bit key). */
export function isWrappedKey(v: unknown): v is string {
  return isB64(v, 4096)
}
