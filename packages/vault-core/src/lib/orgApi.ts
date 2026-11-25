/**
 * Typed client for a RokoPW org server. Pure fetch; no state.
 * (Kept separate from lib/storage.ts, which the desktop app replaces with IPC.)
 */
import type { EncryptedPrivateKey, EncryptedVaultV2 } from './orgCrypto'
import type { EncryptedVault } from './types'

export interface OrgSession {
  serverUrl: string
  token: string
  expiresAt: number
  userId: string
  email: string
}

export type OrgRole = 'admin' | 'member'
export type UserStatus = 'active' | 'invited' | 'disabled'

export interface OrgMe {
  id: string
  email: string
  name: string | null
  role: OrgRole
  status: UserStatus
  publicKey: string | null
  encryptedPrivateKey: EncryptedPrivateKey | null
}

export interface OrgVaultMeta {
  id: string
  name: string
  kind: 'org' | 'legacy'
  revision: number
  updatedAt: number
  canWrite: boolean
  canExport: boolean
  wrappedKey: string | null
  /** Access granted, but the key hasn't been shared with this user yet. */
  pending: boolean
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: OrgRole
  status: UserStatus
  createdAt: number
  lastLoginAt: number | null
  publicKey: string | null
  vaultCount: number
}

export interface AdminVault {
  id: string
  name: string
  kind: 'org' | 'legacy'
  revision: number
  createdAt: number
  updatedAt: number
  memberCount: number
  pendingCount: number
  myWrappedKey: string | null
}

export interface AdminMember {
  userId: string
  email: string
  role: OrgRole
  status: UserStatus
  publicKey: string | null
  canWrite: boolean
  canExport: boolean
  pending: boolean
  joinedAt: number
}

export interface AuditEvent {
  id: number
  at: number
  actor: string | null
  action: string
  target: string | null
  details: Record<string, unknown> | null
}

export class OrgApiError extends Error {
  status: number
  code?: string
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `Request failed (${status})`)
    this.status = status
    this.code = typeof body.code === 'string' ? body.code : undefined
    this.body = body
  }
}

export const normalizeServerUrl = (url: string) => url.trim().replace(/\/+$/, '')

async function request<T>(
  serverUrl: string,
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${serverUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new OrgApiError(0, { error: `Can't reach ${serverUrl}. Check the address and your connection.` })
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new OrgApiError(res.status, body)
  return body as T
}

const authed = (s: Pick<OrgSession, 'serverUrl' | 'token'>) =>
  <T>(path: string, opts: { method?: string; body?: unknown } = {}) =>
    request<T>(s.serverUrl, path, { ...opts, token: s.token })

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function probeServer(serverUrl: string): Promise<{ name: string; mode: string }> {
  const body = await request<{ kind?: string; name?: string; mode?: string }>(normalizeServerUrl(serverUrl), '/')
  if (body.kind !== 'roko-pw-server') throw new OrgApiError(0, { error: 'That address is not a RokoPW server.' })
  if (body.mode !== 'org') {
    throw new OrgApiError(0, { error: 'This RokoPW server is an older version. Ask your admin to update it.' })
  }
  return { name: body.name ?? 'RokoPW Server', mode: body.mode }
}

export interface Credentials {
  email: string
  authHash: string
  /** Only for the one-time upgrade of accounts created before client-side hashing. */
  legacyPassword?: string
}

export function login(serverUrl: string, cred: Credentials) {
  return request<{ otpRequired: boolean; newAccount: boolean }>(serverUrl, '/api/auth/login', { method: 'POST', body: cred })
}

export function verify(serverUrl: string, cred: Credentials & { otp: string }) {
  return request<{ token: string; expiresAt: number }>(serverUrl, '/api/auth/verify', { method: 'POST', body: cred })
}

export const me = (s: OrgSession) => authed(s)<OrgMe>('/api/auth/me')

export const putKeys = (s: OrgSession, publicKey: string, encryptedPrivateKey: EncryptedPrivateKey) =>
  authed(s)<{ ok: true }>('/api/auth/keys', { method: 'PUT', body: { publicKey, encryptedPrivateKey } })

export const logout = (s: OrgSession) => authed(s)<{ ok: true }>('/api/auth/session', { method: 'DELETE' })

// ─── Member vault access ──────────────────────────────────────────────────────

export const listVaults = (s: OrgSession) => authed(s)<OrgVaultMeta[]>('/api/vaults')

export const getVault = (s: OrgSession, id: string) =>
  authed(s)<{ kind: 'org' | 'legacy'; revision: number; blob: EncryptedVaultV2 | EncryptedVault | null }>(
    `/api/vaults/${encodeURIComponent(id)}`,
  )

export const getRevision = (s: OrgSession, id: string) =>
  authed(s)<{ revision: number }>(`/api/vaults/${encodeURIComponent(id)}/revision`)

/** Save; throws OrgApiError 409 with `{ revision, blob }` when someone saved first. */
export const putVault = (s: OrgSession, id: string, baseRevision: number, blob: EncryptedVaultV2) =>
  authed(s)<{ revision: number }>(`/api/vaults/${encodeURIComponent(id)}`, { method: 'PUT', body: { baseRevision, blob } })

export const requestExport = (s: OrgSession, id: string) =>
  authed(s)<{ ok: true }>(`/api/vaults/${encodeURIComponent(id)}/export`, { method: 'POST' })

export const keyTargets = (s: OrgSession, id: string) =>
  authed(s)<Array<{ userId: string; email: string; isAdmin: boolean; publicKey: string | null }>>(
    `/api/vaults/${encodeURIComponent(id)}/key-targets`,
  )

export const convertLegacyVault = (s: OrgSession, id: string, blob: EncryptedVaultV2, wrappedKeys: Record<string, string>) =>
  authed(s)<{ ok: true; revision: number }>(`/api/vaults/${encodeURIComponent(id)}/convert`, {
    method: 'POST',
    body: { blob, wrappedKeys },
  })

// ─── Admin ────────────────────────────────────────────────────────────────────

export const admin = {
  users: (s: OrgSession) => authed(s)<AdminUser[]>('/api/admin/users'),
  addUser: (s: OrgSession, email: string, role: OrgRole, notify = true) =>
    authed(s)<{ id: string; emailed: boolean }>('/api/admin/users', { method: 'POST', body: { email, role, notify } }),
  updateUser: (s: OrgSession, id: string, patch: { role?: OrgRole; status?: 'active' | 'disabled' }) =>
    authed(s)<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PATCH', body: patch }),
  removeUser: (s: OrgSession, id: string) => authed(s)<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  vaults: (s: OrgSession) => authed(s)<AdminVault[]>('/api/admin/vaults'),
  createVault: (s: OrgSession, name: string, blob: EncryptedVaultV2, wrappedKeys: Record<string, string>) =>
    authed(s)<{ id: string }>('/api/admin/vaults', { method: 'POST', body: { name, blob, wrappedKeys } }),
  renameVault: (s: OrgSession, id: string, name: string) =>
    authed(s)<{ ok: true }>(`/api/admin/vaults/${id}`, { method: 'PATCH', body: { name } }),
  deleteVault: (s: OrgSession, id: string) => authed(s)<{ ok: true }>(`/api/admin/vaults/${id}`, { method: 'DELETE' }),

  members: (s: OrgSession, vaultId: string) => authed(s)<AdminMember[]>(`/api/admin/vaults/${vaultId}/members`),
  setMember: (s: OrgSession, vaultId: string, userId: string, body: { canWrite?: boolean; canExport?: boolean; wrappedKey?: string }) =>
    authed(s)<{ ok: true; pending: boolean }>(`/api/admin/vaults/${vaultId}/members/${userId}`, { method: 'PUT', body }),
  removeMember: (s: OrgSession, vaultId: string, userId: string) =>
    authed(s)<{ ok: true }>(`/api/admin/vaults/${vaultId}/members/${userId}`, { method: 'DELETE' }),
  rotate: (s: OrgSession, vaultId: string, baseRevision: number, blob: EncryptedVaultV2, wrappedKeys: Record<string, string>) =>
    authed(s)<{ ok: true; revision: number }>(`/api/admin/vaults/${vaultId}/rotate`, {
      method: 'POST',
      body: { baseRevision, blob, wrappedKeys },
    }),

  audit: (s: OrgSession, limit = 200) => authed(s)<AuditEvent[]>(`/api/admin/audit?limit=${limit}`),
}
