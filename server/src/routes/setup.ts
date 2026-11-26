/**
 * First-run setup: on a brand-new server the admin console shows a setup
 * wizard instead of a sign-in screen.
 *
 * Anyone who can reach a fresh server could otherwise claim it, so creating the
 * first admin needs a one-time setup code that only the person running the
 * server can see: it is printed to the server log at startup (or set with
 * SETUP_TOKEN). The code replaces the emailed sign-in code for this one
 * account, which also means setup works before email is configured.
 *
 * After the admin account exists, the rest of the wizard (email check, sign-up
 * policy, first vaults, inviting people) uses the normal admin API and ends
 * with POST /api/admin/setup/complete.
 */
import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { db, audit, getSetting, setSetting, userCount } from '../db.js'
import { hashPassword, issueSession, randomHex } from '../middleware/auth.js'
import { mailMode } from '../email.js'

export type SetupState = 'needs-admin' | 'in-progress' | 'complete'

const AUTH_HASH = /^[A-Za-z0-9+/]{43}=$/
// Crockford base32 without I, L, O, U: easy to read from a log and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function newSetupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12)) // 12 × 5 bits = 60 bits
  const chars = Array.from(bytes, (b) => ALPHABET[b & 31]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`
}

const normalizeCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')

export function setupState(): SetupState {
  if (getSetting('setup_state') === 'complete') return 'complete'
  return userCount() === 0 ? 'needs-admin' : 'in-progress'
}

export function orgName(): string {
  return getSetting('org_name') ?? ''
}

/**
 * Call once at startup, after initDb. Servers that already had accounts before
 * this feature existed are treated as set up; a new, empty server gets a setup
 * code printed to the log.
 */
export function prepareSetup(): void {
  if (getSetting('setup_state') === null) setSetting('setup_state', userCount() > 0 ? 'complete' : 'pending')
  if (setupState() !== 'needs-admin') {
    setSetting('setup_code', null)
    return
  }
  const fromEnv = (process.env.SETUP_TOKEN ?? '').trim()
  if (!fromEnv && !getSetting('setup_code')) setSetting('setup_code', newSetupCode())
  const code = fromEnv || getSetting('setup_code')!
  const url = `${(process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4567}`).replace(/\/$/, '')}/admin/`
  const line = '─'.repeat(60)
  console.log(
    [
      '',
      line,
      '  This server has not been set up yet.',
      `  Open ${url} and enter this setup code:`,
      '',
      `      ${fromEnv ? '(the SETUP_TOKEN you configured)' : code}`,
      '',
      '  The code works once and stops working after setup.',
      line,
      '',
    ].join('\n'),
  )
}

function expectedCode(): string | null {
  const fromEnv = (process.env.SETUP_TOKEN ?? '').trim()
  return fromEnv || getSetting('setup_code')
}

function codeMatches(given: string): boolean {
  const expected = expectedCode()
  if (!expected) return false
  const a = Buffer.from(normalizeCode(given))
  const b = Buffer.from(normalizeCode(expected))
  return a.length === b.length && timingSafeEqual(a, b)
}

// Guessing a 60-bit code is hopeless anyway; this keeps the log quiet.
const ATTEMPT_LIMIT = 10
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
let attempts = { count: 0, windowStart: 0 }

function tooManyAttempts(): boolean {
  const now = Date.now()
  if (now - attempts.windowStart > ATTEMPT_WINDOW_MS) attempts = { count: 0, windowStart: now }
  attempts.count++
  return attempts.count > ATTEMPT_LIMIT
}

export const setupRoutes = new Hono()

// ── GET /api/setup ────────────────────────────────────────────────────────────
// Public: lets the admin console decide between the setup wizard and sign-in.
setupRoutes.get('/', (c) =>
  c.json({ state: setupState(), orgName: orgName(), mail: mailMode() }),
)

// ── POST /api/setup/check ─────────────────────────────────────────────────────
// Check the setup code before asking for the rest (friendlier wizard).
setupRoutes.post('/check', async (c) => {
  if (setupState() !== 'needs-admin') return c.json({ error: 'This server is already set up.' }, 409)
  if (tooManyAttempts()) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
  const body = await c.req.json<{ setupCode?: string }>().catch(() => ({}) as { setupCode?: string })
  if (!codeMatches(body.setupCode ?? '')) return c.json({ error: 'That setup code is not right. Copy it from the server log.' }, 401)
  return c.json({ ok: true })
})

// ── POST /api/setup/admin ─────────────────────────────────────────────────────
// Create the first admin account and sign it in.
type AdminBody = { setupCode?: string; orgName?: string; name?: string; email?: string; authHash?: string }
setupRoutes.post('/admin', async (c) => {
  if (setupState() !== 'needs-admin') return c.json({ error: 'This server is already set up.' }, 409)
  if (tooManyAttempts()) return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)
  const body = await c.req.json<AdminBody>().catch(() => ({}) as AdminBody)
  if (!codeMatches(body.setupCode ?? '')) return c.json({ error: 'That setup code is not right. Copy it from the server log.' }, 401)

  const org = (body.orgName ?? '').trim().slice(0, 100)
  const name = (body.name ?? '').trim().slice(0, 100)
  const email = (body.email ?? '').trim().toLowerCase()
  if (!org) return c.json({ error: 'Enter your organization name.' }, 400)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ error: 'Enter a valid email address.' }, 400)
  }
  if (!AUTH_HASH.test(body.authHash ?? '')) return c.json({ error: 'Invalid credentials format.' }, 400)

  const id = randomHex(16)
  const passwordHash = await hashPassword(body.authHash!)
  const now = Date.now()
  // Re-check inside the transaction so two simultaneous requests can't both win.
  const created = db.transaction(() => {
    if (userCount() !== 0) return false
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, kdf, role, status, created_at, last_login_at) VALUES (?, ?, ?, ?, 1, 'admin', 'active', ?, ?)",
    ).run(id, email, name || null, passwordHash, now, now)
    setSetting('org_name', org)
    setSetting('setup_code', null)
    return true
  })()
  if (!created) return c.json({ error: 'This server is already set up.' }, 409)

  attempts = { count: 0, windowStart: 0 }
  audit({ id, email }, 'setup.started', null, { org })
  return c.json(await issueSession(id), 201)
})
