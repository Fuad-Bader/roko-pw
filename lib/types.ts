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

export interface EncryptedVault {
  version: 1
  salt: string       // base64-encoded 32-byte random salt (per-vault)
  iv: string         // base64-encoded 12-byte AES-GCM IV (per-save)
  ciphertext: string // base64-encoded AES-256-GCM ciphertext
}

export type StorageBackend = 'local' | 'remote'

export interface VaultSettings {
  backend: StorageBackend
  vaultId: string // UUID, identifies vault on the remote server
}

export type VaultStatus = 'checking' | 'empty' | 'locked' | 'unlocked'

export interface PasswordOptions {
  length: number
  upper: boolean
  digits: boolean
  symbols: boolean
}
