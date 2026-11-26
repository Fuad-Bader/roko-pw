/**
 * Admin actions shared by the console and the setup wizard. All key handling
 * happens here in the browser; the server only receives wrapped keys.
 */
import * as api from '@roko/vault-core/lib/orgApi'
import type { AdminUser, OrgRole, OrgSession } from '@roko/vault-core/lib/orgApi'
import { encryptVaultV2, generateVaultKey, wrapVaultKey } from '@roko/vault-core/lib/orgCrypto'
import { emptyVaultData, serializeVaultData } from '@roko/vault-core/lib/templates'

/** Create an empty org vault. Every admin gets its key (pending if they have no keys yet). */
export async function createOrgVault(session: OrgSession, name: string, users: AdminUser[]): Promise<string> {
  const key = await generateVaultKey()
  const blob = await encryptVaultV2(key, serializeVaultData(emptyVaultData()))
  const admins = users.filter((u) => u.role === 'admin' && u.status !== 'disabled')
  const wrappedKeys: Record<string, string> = {}
  for (const u of admins) if (u.publicKey) wrappedKeys[u.id] = await wrapVaultKey(key, u.publicKey)
  const { id } = await api.admin.createVault(session, name, blob, wrappedKeys)
  for (const u of admins) {
    if (!u.publicKey) await api.admin.setMember(session, id, u.id, { canWrite: true, canExport: true })
  }
  return id
}

export interface Invite {
  email: string
  role: OrgRole
}

export interface VaultGrant {
  vaultId: string
  canWrite: boolean
  canExport: boolean
}

/**
 * Add people and give them access. New people have no keys yet, so access is
 * stored as pending and finished by the console after their first sign-in.
 * Admins get every vault with full rights, as in the People tab.
 */
export async function invitePeople(
  session: OrgSession,
  invites: Invite[],
  grants: VaultGrant[],
  allVaultIds: string[],
  notify: boolean,
): Promise<{ added: string[]; emailed: number; failed: Array<{ email: string; error: string }> }> {
  const added: string[] = []
  const failed: Array<{ email: string; error: string }> = []
  let emailed = 0
  for (const inv of invites) {
    try {
      const res = await api.admin.addUser(session, inv.email, inv.role, notify)
      if (res.emailed) emailed++
      const access =
        inv.role === 'admin' ? allVaultIds.map((vaultId) => ({ vaultId, canWrite: true, canExport: true })) : grants
      for (const g of access) {
        await api.admin.setMember(session, g.vaultId, res.id, { canWrite: g.canWrite, canExport: g.canExport })
      }
      added.push(inv.email)
    } catch (err) {
      failed.push({ email: inv.email, error: err instanceof Error ? err.message : 'Could not add' })
    }
  }
  return { added, emailed, failed }
}

/** Split pasted text into unique, lower-case email addresses (and the rejects). */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim().replace(/^<|>$/g, '').toLowerCase())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) invalid.push(p)
    else if (!valid.includes(p)) valid.push(p)
  }
  return { valid, invalid }
}
