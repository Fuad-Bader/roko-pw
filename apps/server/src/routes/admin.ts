/**
 * Org admin API: users, vaults, per-vault permissions and the audit log.
 *
 * The server never sees vault contents or vault keys. When an admin grants
 * access, the admin's app unwraps the vault key with the admin's private key and
 * wraps it for the new member's public key; the server only stores the result.
 */
import { Hono, type Context } from 'hono'
import { db, audit, getSetting, setSetting, signupPolicy } from '../db.js'
import { requireAuth, requireAdmin, randomHex, type AuthUser } from '../middleware/auth.js'
import { mailMode, sendTestEmail, sendUserAddedEmail } from '../email.js'
import { orgName, setupState } from './setup.js'
import { isVaultV2, isWrappedKey } from '../types.js'

type Env = { Variables: { user: AuthUser } }

export const adminRoutes = new Hono<Env>()
adminRoutes.use('*', requireAuth, requireAdmin)

const ROLES = new Set(['admin', 'member'])

function activeAdminCount(exceptId?: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status != 'disabled' AND id != ?")
      .get(exceptId ?? '') as { n: number }
  ).n
}

function userById(id: string) {
  return db.prepare('SELECT id, email, role, status, public_key FROM users WHERE id = ?').get(id) as
    | { id: string; email: string; role: string; status: string; public_key: string | null }
    | undefined
}

function vaultById(id: string) {
  return db.prepare('SELECT id, name, kind, revision FROM vaults WHERE id = ?').get(id) as
    | { id: string; name: string; kind: string; revision: number }
    | undefined
}

async function json<T>(c: Context): Promise<Partial<T>> {
  return (await c.req.json<T>().catch(() => ({}))) as Partial<T>
}

// ── Users ─────────────────────────────────────────────────────────────────────

adminRoutes.get('/users', (c) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_login_at, u.public_key,
              (SELECT COUNT(*) FROM vault_members vm WHERE vm.user_id = u.id) AS vault_count
       FROM users u ORDER BY u.email COLLATE NOCASE`,
    )
    .all() as Array<{
    id: string
    email: string
    name: string | null
    role: string
    status: string
    created_at: number
    last_login_at: number | null
    public_key: string | null
    vault_count: number
  }>
  return c.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: r.status,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
      publicKey: r.public_key,
      vaultCount: r.vault_count,
    })),
  )
})

// Add a user. They choose their own password at first sign-in.
adminRoutes.post('/users', async (c) => {
  const admin = c.get('user')
  const body = await json<{ email: string; role: string; notify: boolean }>(c)
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ error: 'Enter a valid email address.' }, 400)
  }
  const role = ROLES.has(body.role ?? '') ? body.role! : 'member'
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return c.json({ error: 'A user with this email already exists.' }, 409)
  }
  const id = randomHex(16)
  db.prepare("INSERT INTO users (id, email, role, status, kdf, created_at) VALUES (?, ?, ?, 'invited', 1, ?)").run(
    id,
    email,
    role,
    Date.now(),
  )
  audit(admin, 'user.added', email, { role })
  let emailed = false
  if (body.notify !== false) {
    try {
      await sendUserAddedEmail(email, admin.email)
      emailed = true
    } catch (err) {
      console.error('Failed to send user-added email:', err)
    }
  }
  return c.json({ id, email, role, status: 'invited', emailed }, 201)
})

// Change role and/or status ('active' | 'disabled').
adminRoutes.patch('/users/:id', async (c) => {
  const admin = c.get('user')
  const target = userById(c.req.param('id'))
  if (!target) return c.json({ error: 'Not found' }, 404)
  const body = await json<{ role: string; status: string }>(c)

  if (body.role !== undefined) {
    if (!ROLES.has(body.role)) return c.json({ error: 'Invalid role' }, 400)
    if (target.id === admin.id && body.role !== 'admin') return c.json({ error: "You can't remove your own admin role." }, 400)
    if (target.role === 'admin' && body.role !== 'admin' && activeAdminCount(target.id) === 0) {
      return c.json({ error: 'The org needs at least one admin.' }, 400)
    }
  }
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'disabled') return c.json({ error: 'Invalid status' }, 400)
    if (target.id === admin.id && body.status === 'disabled') return c.json({ error: "You can't disable your own account." }, 400)
    if (target.role === 'admin' && body.status === 'disabled' && activeAdminCount(target.id) === 0) {
      return c.json({ error: 'The org needs at least one active admin.' }, 400)
    }
  }

  db.transaction(() => {
    if (body.role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, target.id)
    if (body.status !== undefined) {
      // Re-enabling an account that never signed in puts it back to 'invited'.
      const hasPassword = !!(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(target.id) as { password_hash: string | null }).password_hash
      const status = body.status === 'active' && !hasPassword ? 'invited' : body.status
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, target.id)
      if (body.status === 'disabled') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id)
    }
  })()
  audit(admin, 'user.updated', target.email, { role: body.role, status: body.status })
  return c.json({ ok: true })
})

adminRoutes.delete('/users/:id', (c) => {
  const admin = c.get('user')
  const target = userById(c.req.param('id'))
  if (!target) return c.json({ error: 'Not found' }, 404)
  if (target.id === admin.id) return c.json({ error: "You can't remove your own account." }, 400)
  if (target.role === 'admin' && activeAdminCount(target.id) === 0) {
    return c.json({ error: 'The org needs at least one admin.' }, 400)
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id) // cascades sessions + memberships
  audit(admin, 'user.removed', target.email)
  return c.json({ ok: true })
})

// ── Vaults ────────────────────────────────────────────────────────────────────

adminRoutes.get('/vaults', (c) => {
  const admin = c.get('user')
  const rows = db
    .prepare(
      `SELECT v.id, v.name, v.kind, v.revision, v.created_at, v.updated_at,
              (SELECT COUNT(*) FROM vault_members vm WHERE vm.vault_id = v.id) AS member_count,
              (SELECT COUNT(*) FROM vault_members vm WHERE vm.vault_id = v.id AND vm.wrapped_key IS NULL) AS pending_count,
              (SELECT wrapped_key FROM vault_members vm WHERE vm.vault_id = v.id AND vm.user_id = ?) AS my_wrapped_key
       FROM vaults v ORDER BY v.name COLLATE NOCASE`,
    )
    .all(admin.id) as Array<{
    id: string
    name: string
    kind: string
    revision: number
    created_at: number
    updated_at: number
    member_count: number
    pending_count: number
    my_wrapped_key: string | null
  }>
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      revision: r.revision,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      memberCount: r.member_count,
      pendingCount: r.kind === 'org' ? r.pending_count : 0,
      myWrappedKey: r.my_wrapped_key,
    })),
  )
})

// Create an org vault. The admin's app generates the vault key, encrypts the
// empty vault, and wraps the key for itself (and any other admins).
adminRoutes.post('/vaults', async (c) => {
  const admin = c.get('user')
  const body = await json<{ name: string; blob: unknown; wrappedKeys: Record<string, unknown> }>(c)
  const name = (body.name ?? '').trim().slice(0, 100)
  if (!name) return c.json({ error: 'Give the vault a name.' }, 400)
  if (!isVaultV2(body.blob)) return c.json({ error: 'Invalid vault payload' }, 400)
  const keys = body.wrappedKeys ?? {}
  if (!isWrappedKey(keys[admin.id])) return c.json({ error: 'Missing your own vault key' }, 400)

  const id = randomHex(16)
  const now = Date.now()
  db.transaction(() => {
    db.prepare("INSERT INTO vaults (id, name, kind, revision, created_by, created_at, updated_at) VALUES (?, ?, 'org', 1, ?, ?, ?)").run(
      id,
      name,
      admin.id,
      now,
      now,
    )
    db.prepare('INSERT INTO vault_data (vault_id, data, updated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(body.blob), now)
    for (const [userId, key] of Object.entries(keys)) {
      const u = userById(userId)
      if (!u || u.role !== 'admin' || !isWrappedKey(key)) continue // only admins at creation
      db.prepare(
        'INSERT INTO vault_members (vault_id, user_id, role, joined_at, wrapped_key, can_write, can_export) VALUES (?, ?, ?, ?, ?, 1, 1)',
      ).run(id, userId, 'member', now, key)
    }
  })()
  audit(admin, 'vault.created', id, { vault: name })
  return c.json({ id, name, kind: 'org', revision: 1 }, 201)
})

adminRoutes.patch('/vaults/:id', async (c) => {
  const admin = c.get('user')
  const vault = vaultById(c.req.param('id'))
  if (!vault) return c.json({ error: 'Not found' }, 404)
  const body = await json<{ name: string }>(c)
  const name = (body.name ?? '').trim().slice(0, 100)
  if (!name) return c.json({ error: 'Name required' }, 400)
  db.prepare('UPDATE vaults SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), vault.id)
  audit(admin, 'vault.renamed', vault.id, { from: vault.name, to: name })
  return c.json({ ok: true })
})

adminRoutes.delete('/vaults/:id', (c) => {
  const admin = c.get('user')
  const vault = vaultById(c.req.param('id'))
  if (!vault) return c.json({ error: 'Not found' }, 404)
  db.prepare('DELETE FROM vaults WHERE id = ?').run(vault.id)
  audit(admin, 'vault.deleted', vault.id, { vault: vault.name })
  return c.json({ ok: true })
})

adminRoutes.get('/vaults/:id/members', (c) => {
  const vault = vaultById(c.req.param('id'))
  if (!vault) return c.json({ error: 'Not found' }, 404)
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.role, u.status, u.public_key, vm.wrapped_key, vm.can_write, vm.can_export, vm.joined_at
       FROM vault_members vm JOIN users u ON u.id = vm.user_id
       WHERE vm.vault_id = ? ORDER BY u.email COLLATE NOCASE`,
    )
    .all(vault.id) as Array<{
    id: string
    email: string
    role: string
    status: string
    public_key: string | null
    wrapped_key: string | null
    can_write: number
    can_export: number
    joined_at: number
  }>
  return c.json(
    rows.map((r) => ({
      userId: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      publicKey: r.public_key,
      canWrite: !!r.can_write,
      canExport: !!r.can_export,
      pending: vault.kind === 'org' && !r.wrapped_key,
      joinedAt: r.joined_at,
    })),
  )
})

// Grant or update a member's access. `wrappedKey` is required to make access
// usable; without it (user has no keys yet) the grant is stored as pending and
// completed later from the admin console.
adminRoutes.put('/vaults/:id/members/:userId', async (c) => {
  const admin = c.get('user')
  const vault = vaultById(c.req.param('id'))
  const target = userById(c.req.param('userId'))
  if (!vault || !target) return c.json({ error: 'Not found' }, 404)
  if (vault.kind !== 'org') return c.json({ error: 'Legacy vaults must be converted before managing access.' }, 409)
  const body = await json<{ canWrite: boolean; canExport: boolean; wrappedKey: string }>(c)
  if (body.wrappedKey !== undefined && !isWrappedKey(body.wrappedKey)) return c.json({ error: 'Invalid wrapped key' }, 400)
  const existing = db.prepare('SELECT can_write, can_export, wrapped_key FROM vault_members WHERE vault_id = ? AND user_id = ?').get(vault.id, target.id) as
    | { can_write: number; can_export: number; wrapped_key: string | null }
    | undefined
  if (target.public_key && body.wrappedKey === undefined && !existing?.wrapped_key) {
    return c.json({ error: 'This user has keys: send their wrapped vault key.' }, 400)
  }
  const canWrite = body.canWrite ?? (existing ? !!existing.can_write : false)
  const canExport = body.canExport ?? (existing ? !!existing.can_export : false)
  const wrappedKey = body.wrappedKey ?? existing?.wrapped_key ?? null

  db.prepare(
    `INSERT INTO vault_members (vault_id, user_id, role, joined_at, wrapped_key, can_write, can_export)
     VALUES (?, ?, 'member', ?, ?, ?, ?)
     ON CONFLICT (vault_id, user_id) DO UPDATE SET wrapped_key = excluded.wrapped_key,
       can_write = excluded.can_write, can_export = excluded.can_export`,
  ).run(vault.id, target.id, Date.now(), wrappedKey, canWrite ? 1 : 0, canExport ? 1 : 0)

  audit(admin, existing ? 'access.updated' : 'access.granted', vault.id, {
    vault: vault.name,
    user: target.email,
    canWrite,
    canExport,
    pending: !wrappedKey,
  })
  return c.json({ ok: true, pending: !wrappedKey })
})

adminRoutes.delete('/vaults/:id/members/:userId', (c) => {
  const admin = c.get('user')
  const vault = vaultById(c.req.param('id'))
  const target = userById(c.req.param('userId'))
  if (!vault || !target) return c.json({ error: 'Not found' }, 404)
  db.prepare('DELETE FROM vault_members WHERE vault_id = ? AND user_id = ?').run(vault.id, target.id)
  audit(admin, 'access.revoked', vault.id, { vault: vault.name, user: target.email })
  return c.json({ ok: true })
})

// Re-key a vault: new vault key, re-encrypted blob, and a freshly wrapped key for
// every member that currently has access. Used after removing someone, so a key
// they may have kept no longer decrypts anything.
adminRoutes.post('/vaults/:id/rotate', async (c) => {
  const admin = c.get('user')
  const vault = vaultById(c.req.param('id'))
  if (!vault || vault.kind !== 'org') return c.json({ error: 'Not found' }, 404)
  const body = await json<{ baseRevision: number; blob: unknown; wrappedKeys: Record<string, unknown> }>(c)
  if (typeof body.baseRevision !== 'number' || !isVaultV2(body.blob) || !body.wrappedKeys) {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  const keys = body.wrappedKeys
  const members = db
    .prepare('SELECT user_id FROM vault_members WHERE vault_id = ? AND wrapped_key IS NOT NULL')
    .all(vault.id) as Array<{ user_id: string }>
  const missing = members.filter((m) => !isWrappedKey(keys[m.user_id]))
  if (missing.length) return c.json({ error: 'A new key is needed for every member.', missing: missing.map((m) => m.user_id) }, 400)

  const now = Date.now()
  const result = db.transaction(() => {
    const current = (db.prepare('SELECT revision FROM vaults WHERE id = ?').get(vault.id) as { revision: number }).revision
    if (current !== body.baseRevision) return { conflict: true as const, revision: current }
    db.prepare('INSERT OR REPLACE INTO vault_data (vault_id, data, updated_at) VALUES (?, ?, ?)').run(vault.id, JSON.stringify(body.blob), now)
    db.prepare('UPDATE vaults SET revision = ?, updated_at = ? WHERE id = ?').run(current + 1, now, vault.id)
    for (const m of members) {
      db.prepare('UPDATE vault_members SET wrapped_key = ? WHERE vault_id = ? AND user_id = ?').run(keys[m.user_id], vault.id, m.user_id)
    }
    return { conflict: false as const, revision: current + 1 }
  })()
  if (result.conflict) return c.json({ error: 'The vault changed while rotating. Try again.', revision: result.revision }, 409)
  audit(admin, 'vault.key_rotated', vault.id, { vault: vault.name })
  return c.json({ ok: true, revision: result.revision })
})

// ── Org settings and first-run setup ──────────────────────────────────────────

function settingsBody() {
  const policy = signupPolicy()
  return {
    orgName: orgName(),
    allowSignups: policy.allowSignups,
    allowSignupsLocked: policy.locked,
    mail: mailMode(),
    setup: setupState(),
  }
}

adminRoutes.get('/settings', (c) => c.json(settingsBody()))

adminRoutes.patch('/settings', async (c) => {
  const admin = c.get('user')
  const body = await json<{ orgName: string; allowSignups: boolean }>(c)
  const changes: Record<string, unknown> = {}
  if (body.orgName !== undefined) {
    const name = String(body.orgName).trim().slice(0, 100)
    if (!name) return c.json({ error: 'Enter your organization name.' }, 400)
    if (name !== orgName()) {
      setSetting('org_name', name)
      changes.orgName = name
    }
  }
  if (body.allowSignups !== undefined) {
    if (typeof body.allowSignups !== 'boolean') return c.json({ error: 'Invalid allowSignups' }, 400)
    if (signupPolicy().locked) return c.json({ error: 'Sign-ups are set by ALLOW_SIGNUPS on the server.' }, 409)
    if ((getSetting('allow_signups') === 'true') !== body.allowSignups) {
      setSetting('allow_signups', String(body.allowSignups))
      changes.allowSignups = body.allowSignups
    }
  }
  if (Object.keys(changes).length) audit(admin, 'settings.updated', null, changes)
  return c.json(settingsBody())
})

// Send a test email to the signed-in admin.
adminRoutes.post('/settings/test-email', async (c) => {
  const admin = c.get('user')
  try {
    await sendTestEmail(admin.email)
  } catch (err) {
    console.error('Test email failed:', err)
    const reason = err instanceof Error ? err.message : String(err)
    return c.json({ error: `Could not send: ${reason.slice(0, 200)}` }, 502)
  }
  return c.json({ ok: true, to: admin.email, mail: mailMode() })
})

adminRoutes.post('/setup/complete', (c) => {
  const admin = c.get('user')
  if (setupState() !== 'complete') {
    setSetting('setup_state', 'complete')
    audit(admin, 'setup.completed')
  }
  return c.json(settingsBody())
})

// ── Audit log ─────────────────────────────────────────────────────────────────

adminRoutes.get('/audit', (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '200') || 200, 1), 1000)
  const rows = db
    .prepare('SELECT id, at, actor_email, action, target, details FROM audit_log ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{ id: number; at: number; actor_email: string | null; action: string; target: string | null; details: string | null }>
  return c.json(
    rows.map((r) => ({
      id: r.id,
      at: r.at,
      actor: r.actor_email,
      action: r.action,
      target: r.target,
      details: r.details ? JSON.parse(r.details) : null,
    })),
  )
})
