import { createMiddleware } from 'hono/factory'
import { db } from '../db.js'

export interface AuthUser {
  id: string
  email: string
  name: string | null
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
      `SELECT s.user_id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as { user_id: string; email: string; name: string | null } | undefined

  if (!row) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', { id: row.user_id, email: row.email, name: row.name })
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
