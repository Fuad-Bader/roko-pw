// Mirrors the client-side EncryptedVault shape — server only validates structure,
// never decrypts.
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
