import { Hono } from 'hono'
import { db } from '../db.js'
import { requireAuth, type AuthUser } from '../middleware/auth.js'
import { randomHex } from '../middleware/auth.js'
import { sendVaultWriteNotification } from '../email.js'
import type { EncryptedVault } from '../types.js'

type Env = { Variables: { user: AuthUser } }

// Track last write-notification per vault to avoid spam (in-memory, fine for single-server)
const lastNotified = new Map<string, number>()
const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

export const vaultRoutes = new Hono<Env>()
vaultRoutes.use('*', requireAuth)

// ── GET /api/vaults  ──────────────────────────────────────────────────────────
// List vaults the authenticated user has access to.
vaultRoutes.get('/', (c) => {
  const user = c.get('user')
  const rows = db
    .prepare(
      `SELECT v.id, v.name, v.created_at, v.updated_at, vm.role,
              (SELECT COUNT(*) FROM vault_members WHERE vault_id = v.id) as member_count
       FROM vaults v
       JOIN vault_members vm ON vm.vault_id = v.id AND vm.user_id = ?
       ORDER BY v.updated_at DESC`,
    )
    .all(user.id) as Array<{
    id: string
    name: string
    created_at: number
    updated_at: number
    role: string
    member_count: number
  }>
  return c.json(rows)
})

// ── POST /api/vaults  ─────────────────────────────────────────────────────────
// Create a new vault owned by the authenticated user.
vaultRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }))
  const name = (body.name ?? 'My Vault').trim().slice(0, 100)
  const now = Date.now()
  const id = randomHex(16)

  db.prepare('INSERT INTO vaults (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    now,
    now,
  )
  db.prepare(
    'INSERT INTO vault_members (vault_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
  ).run(id, user.id, 'owner', now)

  return c.json({ id, name, created_at: now, updated_at: now, role: 'owner', member_count: 1 }, 201)
})

// ── GET /api/vaults/:id  ──────────────────────────────────────────────────────
vaultRoutes.get('/:id', (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')

  if (!isMember(vaultId, user.id)) return c.json({ error: 'Not found' }, 404)

  const row = db
    .prepare('SELECT data FROM vault_data WHERE vault_id = ?')
    .get(vaultId) as { data: string } | undefined

  return c.json(row ? (JSON.parse(row.data) as EncryptedVault) : null)
})

// ── PUT /api/vaults/:id  ──────────────────────────────────────────────────────
// Save (overwrite) encrypted vault blob.
vaultRoutes.put('/:id', async (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')

  if (!isMember(vaultId, user.id)) return c.json({ error: 'Not found' }, 404)

  const vault = await c.req.json<EncryptedVault>().catch(() => null)
  if (!vault || vault.version !== 1 || !vault.salt || !vault.iv || !vault.ciphertext) {
    return c.json({ error: 'Invalid vault payload' }, 400)
  }

  const now = Date.now()
  db.prepare(
    'INSERT OR REPLACE INTO vault_data (vault_id, data, updated_at) VALUES (?, ?, ?)',
  ).run(vaultId, JSON.stringify(vault), now)
  db.prepare('UPDATE vaults SET updated_at = ? WHERE id = ?').run(now, vaultId)

  // Notify other members (debounced per vault)
  const lastAt = lastNotified.get(vaultId) ?? 0
  if (now - lastAt > NOTIFY_COOLDOWN_MS) {
    lastNotified.set(vaultId, now)
    const vaultRow = db
      .prepare('SELECT name FROM vaults WHERE id = ?')
      .get(vaultId) as { name: string }
    const otherMembers = db
      .prepare(
        `SELECT u.email FROM vault_members vm JOIN users u ON u.id = vm.user_id
         WHERE vm.vault_id = ? AND vm.user_id != ?`,
      )
      .all(vaultId, user.id) as Array<{ email: string }>

    sendVaultWriteNotification(
      otherMembers.map((m) => m.email),
      user.email,
      vaultRow.name,
    ).catch(() => {})
  }

  return c.json({ ok: true })
})

// ── PATCH /api/vaults/:id  ───────────────────────────────────────────────────
// Rename a vault (owner only).
vaultRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')

  if (!isOwner(vaultId, user.id)) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }))
  const name = (body.name ?? '').trim().slice(0, 100)
  if (!name) return c.json({ error: 'Name required' }, 400)

  db.prepare('UPDATE vaults SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), vaultId)
  return c.json({ ok: true })
})

// ── DELETE /api/vaults/:id  ──────────────────────────────────────────────────
vaultRoutes.delete('/:id', (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')

  if (!isOwner(vaultId, user.id)) return c.json({ error: 'Forbidden' }, 403)

  db.prepare('DELETE FROM vaults WHERE id = ?').run(vaultId)
  return c.json({ ok: true })
})

// ── GET /api/vaults/:id/members  ─────────────────────────────────────────────
vaultRoutes.get('/:id/members', (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')

  if (!isMember(vaultId, user.id)) return c.json({ error: 'Not found' }, 404)

  const members = db
    .prepare(
      `SELECT u.id, u.email, u.name, vm.role, vm.joined_at
       FROM vault_members vm JOIN users u ON u.id = vm.user_id
       WHERE vm.vault_id = ?`,
    )
    .all(vaultId)
  return c.json(members)
})

// ── DELETE /api/vaults/:id/members/:userId  ──────────────────────────────────
vaultRoutes.delete('/:id/members/:userId', (c) => {
  const user = c.get('user')
  const vaultId = c.req.param('id')
  const targetId = c.req.param('userId')

  // Owner can remove anyone; members can remove themselves
  if (targetId !== user.id && !isOwner(vaultId, user.id)) return c.json({ error: 'Forbidden' }, 403)

  // Prevent owner from removing themselves if there are other members
  if (isOwner(vaultId, targetId)) {
    const count = (db
      .prepare('SELECT COUNT(*) as n FROM vault_members WHERE vault_id = ?')
      .get(vaultId) as { n: number }).n
    if (count > 1) return c.json({ error: 'Transfer ownership before leaving.' }, 400)
  }

  db.prepare('DELETE FROM vault_members WHERE vault_id = ? AND user_id = ?').run(vaultId, targetId)
  return c.json({ ok: true })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMember(vaultId: string, userId: string): boolean {
  return !!(db
    .prepare('SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ?')
    .get(vaultId, userId))
}

function isOwner(vaultId: string, userId: string): boolean {
  return !!(db
    .prepare("SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ? AND role = 'owner'")
    .get(vaultId, userId))
}
