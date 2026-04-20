export interface VaultEntry {
  id: string
  title: string
  url: string
  username: string
  password: string
  notes: string
  createdAt: number
  updatedAt: number
}

/** Recovery blob: the raw vault key wrapped with a key derived from the recovery phrase. */
export interface VaultRecovery {
  salt: string       // PBKDF2 salt for deriving the recovery key from the mnemonic
  iv: string         // AES-GCM IV used when wrapping the vault key
  wrappedKey: string // raw 256-bit vault key encrypted with the recovery key
}

export interface EncryptedVault {
  version: 1
  salt: string        // base64-encoded 32-byte random salt (per-vault)
  iv: string          // base64-encoded 12-byte AES-GCM IV (per-save)
  ciphertext: string  // base64-encoded AES-256-GCM ciphertext of the entries
  recovery?: VaultRecovery
}

export type StorageBackend = 'local' | 'remote'

export interface VaultSettings {
  backend: StorageBackend
  vaultId: string  // UUID, identifies vault on the remote server
  serverUrl: string  // Base URL of self-hosted server, e.g. "https://vault.example.com"
}

/** Active authenticated session against a self-hosted server. Stored in localStorage. */
export interface ServerSession {
  serverUrl: string
  token: string
  userId: string
  email: string
  expiresAt: number
}

/** Vault metadata returned by GET /api/vaults. */
export interface VaultMeta {
  id: string
  name: string
  role: 'owner' | 'member'
  member_count: number
  updated_at: number
}

export type VaultStatus = 'checking' | 'empty' | 'locked' | 'unlocked'

export interface PasswordOptions {
  length: number
  upper: boolean
  digits: boolean
  symbols: boolean
}
