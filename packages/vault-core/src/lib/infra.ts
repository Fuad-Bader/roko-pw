/**
 * Helpers for infrastructure entries (SSH, RDP, VPN).
 *
 * Everything here runs locally on decrypted vault data; nothing is sent anywhere.
 */
import type { VaultEntry, VpnProtocol } from './types'

export const DEFAULT_PORT = { ssh: '22', rdp: '3389' } as const

export const VPN_PROTOCOLS: { id: VpnProtocol; label: string; configExt: string; configLabel: string }[] = [
  { id: 'wireguard', label: 'WireGuard', configExt: 'conf', configLabel: 'WireGuard config (.conf)' },
  { id: 'openvpn', label: 'OpenVPN', configExt: 'ovpn', configLabel: 'OpenVPN profile (.ovpn)' },
  { id: 'ipsec', label: 'IPsec / IKEv2', configExt: 'conf', configLabel: 'IPsec config' },
  { id: 'l2tp', label: 'L2TP / IPsec', configExt: 'conf', configLabel: 'L2TP config' },
  { id: 'other', label: 'Other', configExt: 'txt', configLabel: 'Client config' },
]

export const vpnProtocolMeta = (p: VpnProtocol | undefined) =>
  VPN_PROTOCOLS.find((v) => v.id === p) ?? VPN_PROTOCOLS[VPN_PROTOCOLS.length - 1]

/** Protocols that normally use a pre-shared key. */
export const usesPreSharedKey = (p: VpnProtocol | undefined) => p === 'ipsec' || p === 'l2tp'

/** A valid TCP port, or empty (meaning "use the protocol default"). */
export function isValidPort(port: string): boolean {
  if (!port) return true
  if (!/^\d{1,5}$/.test(port)) return false
  const n = Number(port)
  return n >= 1 && n <= 65535
}

/** "host" or "host:port", omitting the port when it is the protocol default. */
export function hostWithPort(host = '', port = '', defaultPort?: string): string {
  if (!host) return ''
  if (!port || port === defaultPort) return host
  return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`
}

/** A filesystem-friendly name derived from the entry title. */
export function slugify(title: string, fallback = 'roko'): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s || fallback
}

/** Quote a value for a POSIX shell only when it needs it. */
function shq(v: string): string {
  return /^[\w@%+=:,./[\]-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`
}

// ─── SSH ──────────────────────────────────────────────────────────────────────

/** Suggested file name when the private key is downloaded, e.g. "prod-web-01" or "legacy.pem". */
export function keyFileName(entry: Pick<VaultEntry, 'title' | 'privateKey'>): string {
  const base = slugify(entry.title, 'id_roko')
  const info = entry.privateKey ? inspectPrivateKey(entry.privateKey) : null
  return info?.format === 'pem' ? `${base}.pem` : info?.format === 'putty' ? `${base}.ppk` : base
}

/** The ssh command that connects to this entry. */
export function sshCommand(entry: VaultEntry): string {
  const parts = ['ssh']
  if (entry.port && entry.port !== DEFAULT_PORT.ssh) parts.push('-p', shq(entry.port))
  if (entry.jumpHost) parts.push('-J', shq(entry.jumpHost))
  if (entry.sshAuth !== 'password' && entry.privateKey) parts.push('-i', `~/.ssh/${keyFileName(entry)}`)
  const host = entry.host ?? ''
  parts.push(shq(entry.username ? `${entry.username}@${host}` : host))
  return parts.join(' ')
}

/** A ready-to-paste ~/.ssh/config block for this entry. */
export function sshConfigBlock(entry: VaultEntry): string {
  const lines = [`Host ${slugify(entry.title, 'server')}`, `  HostName ${entry.host ?? ''}`]
  if (entry.username) lines.push(`  User ${entry.username}`)
  if (entry.port && entry.port !== DEFAULT_PORT.ssh) lines.push(`  Port ${entry.port}`)
  if (entry.jumpHost) lines.push(`  ProxyJump ${entry.jumpHost}`)
  if (entry.sshAuth !== 'password' && entry.privateKey) {
    lines.push(`  IdentityFile ~/.ssh/${keyFileName(entry)}`, '  IdentitiesOnly yes')
  }
  return lines.join('\n')
}

export interface KeyInfo {
  format: 'openssh' | 'pem' | 'pkcs8' | 'putty' | 'unknown'
  /** Human-readable algorithm, e.g. "Ed25519", "RSA", "ECDSA P-256". */
  algorithm: string | null
  /** true = protected by a passphrase, false = plain, null = can't tell. */
  encrypted: boolean | null
  /** OpenSSH public key line recovered from the private key (OpenSSH format only). */
  publicKey: string | null
}

const ALGO_NAMES: Record<string, string> = {
  'ssh-ed25519': 'Ed25519',
  'sk-ssh-ed25519@openssh.com': 'Ed25519-SK (security key)',
  'ssh-rsa': 'RSA',
  'ssh-dss': 'DSA',
  'ecdsa-sha2-nistp256': 'ECDSA P-256',
  'ecdsa-sha2-nistp384': 'ECDSA P-384',
  'ecdsa-sha2-nistp521': 'ECDSA P-521',
  'sk-ecdsa-sha2-nistp256@openssh.com': 'ECDSA-SK (security key)',
}

export const algorithmName = (keyType: string) => ALGO_NAMES[keyType] ?? keyType

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/\s+/g, ''))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Reads SSH wire-format length-prefixed strings. */
class SshReader {
  private o = 0
  private b: Uint8Array
  constructor(b: Uint8Array) {
    this.b = b
  }
  bytes(): Uint8Array {
    if (this.o + 4 > this.b.length) throw new Error('eof')
    const len = new DataView(this.b.buffer, this.b.byteOffset + this.o, 4).getUint32(0)
    this.o += 4
    if (this.o + len > this.b.length) throw new Error('eof')
    const v = this.b.subarray(this.o, this.o + len)
    this.o += len
    return v
  }
  string(): string {
    return new TextDecoder().decode(this.bytes())
  }
  uint32(): number {
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.o, 4).getUint32(0)
    this.o += 4
    return v
  }
  skip(n: number) {
    this.o += n
  }
}

const OPENSSH_MAGIC = 'openssh-key-v1\0'

/**
 * Identify a private key's format, algorithm and whether it is passphrase-protected,
 * without needing the passphrase. OpenSSH keys keep their public half in clear text,
 * so the public key line can be recovered too.
 */
export function inspectPrivateKey(text: string): KeyInfo {
  const t = text.trim()
  const unknown: KeyInfo = { format: 'unknown', algorithm: null, encrypted: null, publicKey: null }
  if (!t) return unknown

  const openssh = t.match(/-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+?)-----END OPENSSH PRIVATE KEY-----/)
  if (openssh) {
    const bytes = b64ToBytes(openssh[1])
    if (!bytes) return { ...unknown, format: 'openssh' }
    try {
      const magic = new TextDecoder().decode(bytes.subarray(0, OPENSSH_MAGIC.length))
      if (magic !== OPENSSH_MAGIC) throw new Error('magic')
      const r = new SshReader(bytes)
      r.skip(OPENSSH_MAGIC.length)
      const cipher = r.string()
      r.string() // kdf name
      r.bytes() // kdf options
      const nKeys = r.uint32()
      if (nKeys < 1) throw new Error('no keys')
      const pubBlob = r.bytes()
      const keyType = new SshReader(pubBlob).string()
      return {
        format: 'openssh',
        algorithm: algorithmName(keyType),
        encrypted: cipher !== 'none',
        publicKey: `${keyType} ${bytesToB64(pubBlob)}`,
      }
    } catch {
      return { ...unknown, format: 'openssh' }
    }
  }

  const pem = t.match(/-----BEGIN ((?:RSA|EC|DSA|ENCRYPTED) )?PRIVATE KEY-----/)
  if (pem) {
    const kind = (pem[1] ?? '').trim()
    if (kind === 'ENCRYPTED') return { format: 'pkcs8', algorithm: null, encrypted: true, publicKey: null }
    if (!kind) return { format: 'pkcs8', algorithm: null, encrypted: false, publicKey: null }
    return {
      format: 'pem',
      algorithm: kind === 'RSA' ? 'RSA' : kind === 'EC' ? 'ECDSA' : 'DSA',
      encrypted: /Proc-Type:\s*4,ENCRYPTED/.test(t),
      publicKey: null,
    }
  }

  const putty = t.match(/^PuTTY-User-Key-File-\d+:\s*(\S+)/m)
  if (putty) {
    const enc = t.match(/^Encryption:\s*(\S+)/m)?.[1]
    return {
      format: 'putty',
      algorithm: algorithmName(putty[1]),
      encrypted: enc ? enc !== 'none' : null,
      publicKey: null,
    }
  }

  return unknown
}

/** Key type of an OpenSSH public key line, or null if it doesn't look like one. */
export function publicKeyType(line: string): string | null {
  const [type, data] = line.trim().split(/\s+/)
  if (!type || !data || !/^(ssh-|ecdsa-|sk-)/.test(type)) return null
  return type
}

/** SHA256 fingerprint in the same form `ssh-keygen -lf` prints ("SHA256:…"). */
export async function publicKeyFingerprint(line: string): Promise<string | null> {
  const [, data] = line.trim().split(/\s+/)
  if (!publicKeyType(line) || !data) return null
  const blob = b64ToBytes(data)
  if (!blob) return null
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob as BufferSource))
  return `SHA256:${bytesToB64(digest).replace(/=+$/, '')}`
}

// ─── RDP ──────────────────────────────────────────────────────────────────────

/**
 * A Remote Desktop (.rdp) connection file. The password is deliberately not
 * written: .rdp files can only hold it DPAPI-encrypted for one Windows user,
 * so the client prompts for it instead.
 */
export function rdpFile(entry: VaultEntry): string {
  const user = entry.username ? (entry.domain ? `${entry.domain}\\${entry.username}` : entry.username) : ''
  const lines = [
    `full address:s:${hostWithPort(entry.host, entry.port, DEFAULT_PORT.rdp)}`,
    ...(user ? [`username:s:${user}`] : []),
    'prompt for credentials:i:1',
    'authentication level:i:2',
    'screen mode id:i:2',
    'use multimon:i:0',
    'redirectclipboard:i:1',
  ]
  if (entry.gateway) {
    lines.push(
      `gatewayhostname:s:${entry.gateway}`,
      'gatewayusagemethod:i:1',
      'gatewayprofileusagemethod:i:1',
      'gatewaycredentialssource:i:0',
      'promptcredentialonce:i:1',
    )
  }
  return lines.join('\r\n') + '\r\n'
}

// ─── Files ────────────────────────────────────────────────────────────────────

/** Save text as a file via the browser's download flow. */
export function downloadTextFile(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Read a small text file chosen by the user (keys, configs). */
export async function readTextFile(file: File, maxBytes = 256 * 1024): Promise<string> {
  if (file.size > maxBytes) throw new Error(`File is too large (max ${Math.round(maxBytes / 1024)} KB).`)
  return file.text()
}
