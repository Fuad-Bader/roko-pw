import { Hono } from 'hono'
import { db } from '../db.js'
import { requireAuth, randomHex, type AuthUser } from '../middleware/auth.js'
import { sendInviteEmail, sendInviteAcceptedEmail } from '../email.js'

type Env = { Variables: { user: AuthUser } }

const INVITE_TTL_MS = parseInt(process.env.INVITE_TTL_DAYS ?? '7') * 86400 * 1000

export const shareRoutes = new Hono<Env>()

// ── POST /api/vaults/:id/invite  ─────────────────────────────────────────────
// Invite a user to a vault by email. Vault password is passed from the client
// (it knows the password since the vault is unlocked) — server never stores it.
shareRoutes.post('/vaults/:id/invite', requireAuth, async (c) => {
  const inviter = c.get('user')
  const vaultId = c.req.param('id')

  // Must be a member to invite
  const membership = db
    .prepare('SELECT role FROM vault_members WHERE vault_id = ? AND user_id = ?')
    .get(vaultId, inviter.id) as { role: string } | undefined
  if (!membership) return c.json({ error: 'Not found' }, 404)

  const body = await c
    .req.json<{ email?: string; vaultPassword?: string; role?: string }>()
    .catch(() => ({ email: undefined, vaultPassword: undefined, role: undefined }))

  const invitedEmail = (body.email ?? '').trim().toLowerCase()
  if (!invitedEmail || !invitedEmail.includes('@')) return c.json({ error: 'Invalid email' }, 400)

  const vaultPassword = (body.vaultPassword ?? '').trim()
  if (!vaultPassword) return c.json({ error: 'vaultPassword required' }, 400)

  const role = body.role === 'owner' ? 'member' : (body.role ?? 'member') // prevent owner escalation

  const vault = db
    .prepare('SELECT name FROM vaults WHERE id = ?')
    .get(vaultId) as { name: string } | undefined
  if (!vault) return c.json({ error: 'Not found' }, 404)

  // Prevent duplicate pending invite
  const existing = db
    .prepare(
      'SELECT id FROM vault_invites WHERE vault_id = ? AND invited_email = ? AND accepted = 0 AND expires_at > ?',
    )
    .get(vaultId, invitedEmail, Date.now())
  if (existing) return c.json({ error: 'A pending invite already exists for this email.' }, 409)

  const now = Date.now()
  const token = randomHex(32)
  const id = randomHex(16)

  db.prepare(
    `INSERT INTO vault_invites (id, vault_id, invited_by, invited_email, role, token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, vaultId, inviter.id, invitedEmail, role, token, now, now + INVITE_TTL_MS)

  try {
    await sendInviteEmail(invitedEmail, inviter.email, vault.name, token, vaultPassword)
  } catch (err) {
    console.error('Failed to send invite email:', err)
    db.prepare('DELETE FROM vault_invites WHERE id = ?').run(id)
    return c.json({ error: 'Failed to send invite email.' }, 500)
  }

  return c.json({ ok: true, inviteId: id })
})

// ── GET /api/invite/:token  ───────────────────────────────────────────────────
// Public: get invite info before accepting (so the client can show who's inviting to what).
shareRoutes.get('/invite/:token', (c) => {
  const token = c.req.param('token')
  const now = Date.now()

  const row = db
    .prepare(
      `SELECT vi.id, vi.vault_id, vi.invited_email, vi.role, vi.expires_at,
              v.name as vault_name, u.email as inviter_email
       FROM vault_invites vi
       JOIN vaults v ON v.id = vi.vault_id
       JOIN users u ON u.id = vi.invited_by
       WHERE vi.token = ? AND vi.accepted = 0 AND vi.expires_at > ?`,
    )
    .get(token, now) as
    | {
        id: string
        vault_id: string
        invited_email: string
        role: string
        expires_at: number
        vault_name: string
        inviter_email: string
      }
    | undefined

  if (!row) return c.json({ error: 'Invite not found or expired.' }, 404)

  return c.json({
    vaultId: row.vault_id,
    vaultName: row.vault_name,
    inviterEmail: row.inviter_email,
    invitedEmail: row.invited_email,
    role: row.role,
    expiresAt: row.expires_at,
  })
})

// ── POST /api/invite/:token/accept  ──────────────────────────────────────────
// Authenticated user accepts a vault invite.
shareRoutes.post('/invite/:token/accept', requireAuth, (c) => {
  const user = c.get('user')
  const token = c.req.param('token')
  const now = Date.now()

  const invite = db
    .prepare(
      `SELECT vi.id, vi.vault_id, vi.invited_email, vi.role, vi.invited_by,
              v.name as vault_name, u.email as inviter_email
       FROM vault_invites vi
       JOIN vaults v ON v.id = vi.vault_id
       JOIN users u ON u.id = vi.invited_by
       WHERE vi.token = ? AND vi.accepted = 0 AND vi.expires_at > ?`,
    )
    .get(token, now) as
    | {
        id: string
        vault_id: string
        invited_email: string
        role: string
        invited_by: string
        vault_name: string
        inviter_email: string
      }
    | undefined

  if (!invite) return c.json({ error: 'Invite not found or expired.' }, 404)

  // The invite is for a specific email — logged-in user's email must match
  if (invite.invited_email !== user.email) {
    return c.json({ error: 'This invite was sent to a different email address.' }, 403)
  }

  // Already a member?
  const alreadyMember = db
    .prepare('SELECT 1 FROM vault_members WHERE vault_id = ? AND user_id = ?')
    .get(invite.vault_id, user.id)
  if (alreadyMember) {
    db.prepare('UPDATE vault_invites SET accepted = 1 WHERE id = ?').run(invite.id)
    return c.json({ ok: true, vaultId: invite.vault_id })
  }

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO vault_members (vault_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
    ).run(invite.vault_id, user.id, invite.role, now)
    db.prepare('UPDATE vault_invites SET accepted = 1 WHERE id = ?').run(invite.id)
  })
  tx()

  // Notify the vault owner
  const inviterUser = db
    .prepare('SELECT email FROM users WHERE id = ?')
    .get(invite.invited_by) as { email: string } | undefined
  if (inviterUser) {
    sendInviteAcceptedEmail(inviterUser.email, user.email, invite.vault_name).catch(() => {})
  }

  return c.json({ ok: true, vaultId: invite.vault_id })
})
