/** The kind of item an entry represents. Drives which fields/forms are shown. */
export type EntryType = 'login' | 'card' | 'note' | 'passkey' | 'ssh' | 'rdp' | 'vpn' | 'custom'

/** Infrastructure item types (developer / enterprise access). */
export const INFRA_TYPES: readonly EntryType[] = ['ssh', 'rdp', 'vpn']

// ─── Credential templates ─────────────────────────────────────────────────────

/** How a template field is entered and displayed. */
export type FieldKind = 'text' | 'secret' | 'multiline' | 'secretMultiline' | 'url' | 'email' | 'number'

export interface TemplateField {
  /** Stable key into `VaultEntry.fields`; never changes when the label is renamed. */
  id: string
  label: string
  kind: FieldKind
  required: boolean
  placeholder?: string
}

/** A template's icon: from the built-in SVG library, an emoji, or an uploaded SVG. */
export type TemplateIcon =
  | { kind: 'library'; name: string }
  | { kind: 'emoji'; value: string }
  | { kind: 'svg'; dataUrl: string }

/** Built-in item types a template can extend. 'custom' = a template built from scratch. */
export type TemplateBase = 'ssh' | 'rdp' | 'vpn' | 'custom'

export interface CredentialTemplate {
  id: string
  name: string
  icon: TemplateIcon
  /** For ssh/rdp/vpn the built-in fields and actions are kept and `fields` are added after them. */
  base: TemplateBase
  /** Extra fields (all fields, for base 'custom'). */
  fields: TemplateField[]
  createdAt: number
  updatedAt: number
}

/** How an SSH entry authenticates. */
export type SshAuth = 'key' | 'password'

/** VPN protocol, used to label the entry and name downloaded config files. */
export type VpnProtocol = 'wireguard' | 'openvpn' | 'ipsec' | 'l2tp' | 'other'

export interface VaultEntry {
  id: string
  type: EntryType
  title: string
  url: string
  username: string
  password: string
  notes: string
  /** Starred for quick access (Favorites). */
  favorite: boolean
  /** Collection (folder) this entry belongs to, or null for uncategorised. */
  collectionId: string | null
  /** Soft-delete timestamp — non-null means the entry is in the Trash. */
  deletedAt: number | null
  // ── Card-specific (type === 'card') ──
  cardNumber?: string
  cardholder?: string
  expiry?: string // MM/YY
  cvv?: string
  // ── Infrastructure (type === 'ssh' | 'rdp' | 'vpn') ──
  // `username` and `password` above are reused for these types.
  /** Hostname or IP. For VPN, the server / endpoint. */
  host?: string
  /** Kept as a string so an empty field means "protocol default" (22 / 3389). */
  port?: string
  // SSH
  sshAuth?: SshAuth
  /** OpenSSH or PEM private key text. */
  privateKey?: string
  /** OpenSSH public key line, e.g. "ssh-ed25519 AAAA… comment". */
  publicKey?: string
  /** Passphrase that unlocks `privateKey`, if it is encrypted. */
  passphrase?: string
  /** Bastion / jump host in ssh -J form, e.g. "admin@bastion.example.com:22". */
  jumpHost?: string
  // RDP
  domain?: string
  /** Remote Desktop Gateway hostname. */
  gateway?: string
  // VPN
  vpnProtocol?: VpnProtocol
  /** IPsec / L2TP pre-shared key. */
  preSharedKey?: string
  /** Full client config file (WireGuard .conf, OpenVPN .ovpn, …). */
  config?: string
  // ── Templates ──
  /** Custom template this entry was created from (absent for plain built-in items). */
  templateId?: string
  /** Values of the template's fields, keyed by TemplateField.id. */
  fields?: Record<string, string>
  createdAt: number
  updatedAt: number
}

/** The editable fields a form produces — identity/metadata are managed by the provider. */
export type EntryDraft = Pick<
  VaultEntry,
  | 'type' | 'title' | 'url' | 'username' | 'password' | 'notes'
  | 'cardNumber' | 'cardholder' | 'expiry' | 'cvv'
  | 'host' | 'port' | 'sshAuth' | 'privateKey' | 'publicKey' | 'passphrase' | 'jumpHost'
  | 'domain' | 'gateway' | 'vpnProtocol' | 'preSharedKey' | 'config'
  | 'templateId' | 'fields'
>

/** A user-defined folder that entries can be organised into. */
export interface Collection {
  id: string
  name: string
  createdAt: number
}

/** The decrypted vault payload (what the ciphertext serialises to). */
export interface VaultData {
  entries: VaultEntry[]
  collections: Collection[]
  /** User-defined credential templates (built-in ones are not stored). */
  templates: CredentialTemplate[]
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
