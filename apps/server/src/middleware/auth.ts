import { createMiddleware } from 'hono/factory'
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from '../db.js'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'member'
}

// Attach to Hono context variables
type Env = { Variables: { user: AuthUser } }

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const tokenHash = await sha256(token)
  const now = Date.now()

  const row = db
    .prepare(
      `SELECT s.user_id, u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status != 'disabled'`,
    )
    .get(tokenHash, now) as { user_id: string; email: string; name: string | null; role: string } | undefined

  if (!row) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', { id: row.user_id, email: row.email, name: row.name, role: row.role === 'admin' ? 'admin' : 'member' })
  await next()
})

/** Use after requireAuth: only org admins may continue. */
export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  if (c.get('user')?.role !== 'admin') return c.json({ error: 'Admins only' }, 403)
  await next()
})

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_DAYS ?? '30') * 86400 * 1000

/** Create a session for a user; returns the bearer token (stored hashed). */
export async function issueSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const now = Date.now()
  const token = randomHex(32)
  db.prepare('INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    randomHex(16),
    await sha256(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  )
  return { token, expiresAt: now + SESSION_TTL_MS }
}

// ── Account password hashing (scrypt; no external dependency) ──────────────────
// Stored as "scrypt$<saltHex>$<hashHex>".

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
