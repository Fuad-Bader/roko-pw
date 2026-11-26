import { Hono } from 'hono'
import { db, audit } from '../db.js'
import { requireAuth, type AuthUser } from '../middleware/auth.js'
import { sendVaultWriteNotification } from '../email.js'
import { isVaultV2, isWrappedKey, type EncryptedVault } from '../types.js'

type Env = { Variables: { user: AuthUser } }

// Debounce "vault updated" emails per vault (in-memory; fine for a single server).
const lastNotified = new Map<string, number>()
const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000
const NOTIFY_ON_WRITE = (process.env.NOTIFY_ON_WRITE ?? 'false').trim().toLowerCase() === 'true'

export const vaultRoutes = new Hono<Env>()
vaultRoutes.use('*', requireAuth)

type Membership = {
  vault_id: string
  name: string
  kind: 'legacy' | 'org'
  revision: number
  updated_at: number
  wrapped_key: string | null
  can_write: number
  can_export: number
}

function membership(vaultId: string, userId: string): Membership | undefined {
  return db
    .prepare(
      `SELECT vm.vault_id, v.name, v.kind, v.revision, v.updated_at, vm.wrapped_key, vm.can_write, vm.can_export
       FROM vault_members vm JOIN vaults v ON v.id = vm.vault_id
       WHERE vm.vault_id = ? AND vm.user_id = ?`,
    )
    .get(vaultId, userId) as Membership | undefined
}

/** An org vault can only be opened once the member's key has been granted. */
function usable(m: Membership | undefined): m is Membership {
  return !!m && (m.kind === 'legacy' || !!m.wrapped_key)
}

// ── GET /api/vaults ───────────────────────────────────────────────────────────
// Vaults this user belongs to, with their permissions and wrapped vault key.
vaultRoutes.get('/', (c) => {
  const user = c.get('user')
  const rows = db
    .prepare(
      `SELECT v.id, v.name, v.kind, v.revision, v.updated_at, vm.wrapped_key, vm.can_write, vm.can_export
       FROM vault_members vm JOIN vaults v ON v.id = vm.vault_id
       WHERE vm.user_id = ?
       ORDER BY v.name COLLATE NOCASE`,
    )
    .all(user.id) as Array<Omit<Membership, 'vault_id'> & { id: string }>
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      revision: r.revision,
      updatedAt: r.updated_at,
      canWrite: !!r.can_write,
      canExport: !!r.can_export,
      wrappedKey: r.wrapped_key,
      pending: r.kind === 'org' && !r.wrapped_key,
    })),
  )
})

// ── GET /api/vaults/:id ───────────────────────────────────────────────────────
vaultRoutes.get('/:id', (c) => {
  const user = c.get('user')
  const m = membership(c.req.param('id'), user.id)
  if (!m) return c.json({ error: 'Not found' }, 404)
  if (!usable(m)) return c.json({ error: 'Your access to this vault is still being set up by an admin.' }, 403)
  const row = db.prepare('SELECT data FROM vault_data WHERE vault_id = ?').get(m.vault_id) as { data: string } | undefined
  return c.json({ kind: m.kind, revision: m.revision, blob: row ? JSON.parse(row.data) : null })
})

// ── GET /api/vaults/:id/revision ──────────────────────────────────────────────
// Cheap poll so clients notice changes made by other members.
vaultRoutes.get('/:id/revision', (c) => {
  const m = membership(c.req.param('id'), c.get('user').id)
  if (!usable(m)) return c.json({ error: 'Not found' }, 404)
  return c.json({ revision: m.revision })
})

// ── PUT /api/vaults/:id ───────────────────────────────────────────────────────
// Save an org vault. Optimistic concurrency: the client sends the revision it
// edited; if someone saved since, it gets 409 with the latest blob to merge.
vaultRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const m = membership(c.req.param('id'), user.id)
  if (!usable(m)) return c.json({ error: 'Not found' }, 404)
  if (m.kind !== 'org') return c.json({ error: 'Convert this legacy vault before editing it.' }, 409)
  if (!m.can_write) return c.json({ error: 'You have read-only access to this vault.' }, 403)

  const body = await c.req.json<{ baseRevision?: number; blob?: unknown }>().catch(() => null)
  if (!body || typeof body.baseRevision !== 'number' || !isVaultV2(body.blob)) {
    return c.json({ error: 'Invalid vault payload' }, 400)
  }

  const now = Date.now()
  const result = db.transaction(() => {
    const current = db.prepare('SELECT revision FROM vaults WHERE id = ?').get(m.vault_id) as { revision: number }
    if (current.revision !== body.baseRevision) return { conflict: true as const }
    const next = current.revision + 1
    db.prepare('INSERT OR REPLACE INTO vault_data (vault_id, data, updated_at) VALUES (?, ?, ?)').run(
      m.vault_id,
      JSON.stringify(body.blob),
      now,
    )
    db.prepare('UPDATE vaults SET revision = ?, updated_at = ? WHERE id = ?').run(next, now, m.vault_id)
    return { conflict: false as const, revision: next }
  })()

  if (result.conflict) {
    const latest = db.prepare('SELECT data FROM vault_data WHERE vault_id = ?').get(m.vault_id) as { data: string } | undefined
    const rev = (db.prepare('SELECT revision FROM vaults WHERE id = ?').get(m.vault_id) as { revision: number }).revision
    return c.json({ error: 'conflict', revision: rev, blob: latest ? JSON.parse(latest.data) : null }, 409)
  }

  if (NOTIFY_ON_WRITE && now - (lastNotified.get(m.vault_id) ?? 0) > NOTIFY_COOLDOWN_MS) {
    lastNotified.set(m.vault_id, now)
    const others = db
      .prepare(
        `SELECT u.email FROM vault_members vm JOIN users u ON u.id = vm.user_id
         WHERE vm.vault_id = ? AND vm.user_id != ? AND u.status = 'active'`,
      )
      .all(m.vault_id, user.id) as Array<{ email: string }>
    sendVaultWriteNotification(others.map((o) => o.email), user.email, m.name).catch(() => {})
  }
  return c.json({ revision: result.revision })
})

// ── POST /api/vaults/:id/export ───────────────────────────────────────────────
// Ask permission to download (export) a vault. The app only offers export after
// this succeeds; every attempt is audited.
vaultRoutes.post('/:id/export', (c) => {
  const user = c.get('user')
  const m = membership(c.req.param('id'), user.id)
  if (!usable(m)) return c.json({ error: 'Not found' }, 404)
  if (!m.can_export) {
    audit(user, 'vault.export_denied', m.vault_id, { vault: m.name })
    return c.json({ error: 'Your admin has not allowed downloading this vault.' }, 403)
  }
  audit(user, 'vault.export', m.vault_id, { vault: m.name })
  return c.json({ ok: true })
})

// ── Legacy (shared vault-password) vaults ─────────────────────────────────────
// Members who know a legacy vault's password can convert it to an org vault:
// the client decrypts it, re-encrypts with a new vault key and wraps that key
// for every member and admin that has keys.

// GET /api/vaults/:id/key-targets: public keys to wrap the new vault key for.
vaultRoutes.get('/:id/key-targets', (c) => {
  const user = c.get('user')
  const m = membership(c.req.param('id'), user.id)
  if (!m || m.kind !== 'legacy') return c.json({ error: 'Not found' }, 404)
  const rows = db
    .prepare(
      `SELECT DISTINCT u.id, u.email, u.role, u.public_key FROM users u
       WHERE u.status != 'disabled' AND (u.role = 'admin' OR u.id IN (SELECT user_id FROM vault_members WHERE vault_id = ?))`,
    )
    .all(m.vault_id) as Array<{ id: string; email: string; role: string; public_key: string | null }>
  return c.json(rows.map((r) => ({ userId: r.id, email: r.email, isAdmin: r.role === 'admin', publicKey: r.public_key })))
})

// POST /api/vaults/:id/convert { blob: v2, wrappedKeys: { [userId]: key } }
vaultRoutes.post('/:id/convert', async (c) => {
  const user = c.get('user')
  const m = membership(c.req.param('id'), user.id)
  if (!m || m.kind !== 'legacy') return c.json({ error: 'Not found' }, 404)
  if (!m.can_write) return c.json({ error: 'You have read-only access to this vault.' }, 403)
  const body = await c.req.json<{ blob?: unknown; wrappedKeys?: Record<string, unknown> }>().catch(() => null)
  if (!body || !isVaultV2(body.blob) || !body.wrappedKeys || typeof body.wrappedKeys !== 'object') {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  const keys = body.wrappedKeys
  if (!isWrappedKey(keys[user.id])) return c.json({ error: 'Missing your own key' }, 400)
  for (const v of Object.values(keys)) if (!isWrappedKey(v)) return c.json({ error: 'Invalid wrapped key' }, 400)

  const now = Date.now()
  db.transaction(() => {
    db.prepare('INSERT OR REPLACE INTO vault_data (vault_id, data, updated_at) VALUES (?, ?, ?)').run(
      m.vault_id,
      JSON.stringify(body.blob),
      now,
    )
    db.prepare("UPDATE vaults SET kind = 'org', revision = 1, updated_at = ? WHERE id = ?").run(now, m.vault_id)
    // Existing members keep their access; admins get full access.
    const members = db.prepare('SELECT user_id FROM vault_members WHERE vault_id = ?').all(m.vault_id) as Array<{ user_id: string }>
    for (const { user_id } of members) {
      db.prepare('UPDATE vault_members SET wrapped_key = ? WHERE vault_id = ? AND user_id = ?').run(
        (keys[user_id] as string | undefined) ?? null,
        m.vault_id,
        user_id,
      )
    }
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND status != 'disabled'").all() as Array<{ id: string }>
    for (const { id } of admins) {
      if (members.some((x) => x.user_id === id)) continue
      db.prepare(
        'INSERT INTO vault_members (vault_id, user_id, role, joined_at, wrapped_key, can_write, can_export) VALUES (?, ?, ?, ?, ?, 1, 1)',
      ).run(m.vault_id, id, 'member', now, (keys[id] as string | undefined) ?? null)
    }
  })()
  audit(user, 'vault.converted', m.vault_id, { vault: m.name })
  return c.json({ ok: true, revision: 1 })
})

// Legacy blobs are read through GET /:id (kind 'legacy', blob version 1).
export type { EncryptedVault }
