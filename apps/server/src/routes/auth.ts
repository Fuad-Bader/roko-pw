import { Hono, type Context } from 'hono'
import { db, audit, configuredAdminEmails, signupPolicy, userCount } from '../db.js'
import { sendOtpEmail } from '../email.js'
import { requireAuth, sha256, randomHex, hashPassword, verifyPassword, issueSession, type AuthUser } from '../middleware/auth.js'
import { isB64 } from '../types.js'

const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MINUTES ?? '15') * 60 * 1000
// Max OTP requests per email per 15-minute window
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

// Org servers are invite-only by default: an admin adds people from the admin
// console, or allows sign-ups there (ALLOW_SIGNUPS in the environment overrides).
// A new, empty server is claimed through the setup wizard (routes/setup.ts), not
// here, unless the email is listed in ADMIN_EMAILS.

/**
 * Clients never send the account password. They derive a key from it locally
 * (PBKDF2, 600k rounds) and send `authHash`, a one-round hash of that key. The
 * server stores scrypt(authHash). Accounts created before this (kdf = 0) stored
 * scrypt(password); they upgrade once by also sending `legacyPassword`.
 */
const AUTH_HASH = /^[A-Za-z0-9+/]{43}=$/

type UserRow = {
  id: string
  email: string
  password_hash: string | null
  kdf: number
  status: string
  role: string
}

function getUser(email: string): UserRow | undefined {
  return db
    .prepare('SELECT id, email, password_hash, kdf, status, role FROM users WHERE email = ?')
    .get(email) as UserRow | undefined
}

// An email may authenticate if it already has an (enabled) account or the server
// accepts sign-ups. On an empty server only ADMIN_EMAILS may (the email code
// proves they own the address); everyone else must use the setup wizard.
function mayAuthenticate(email: string): boolean {
  const user = getUser(email)
  if (user) return user.status !== 'disabled'
  if (userCount() === 0) return configuredAdminEmails().has(email)
  return signupPolicy().allowSignups
}

const INVITE_ONLY_ERROR = 'This server is invite-only. Ask your org admin to add you.'
const DISABLED_ERROR = 'This account has been disabled. Contact your org admin.'
const SETUP_ERROR = 'This server has not been set up yet. Open its admin console (/admin) to set it up.'

export const authRoutes = new Hono<{ Variables: { user: AuthUser } }>()

async function issueOtp(c: Context, email: string): Promise<Response | null> {
  const now = Date.now()
  const rate = db.prepare('SELECT count, window_start FROM otp_rate WHERE email = ?').get(email) as
    | { count: number; window_start: number }
    | undefined

  if (rate && now - rate.window_start < RATE_WINDOW_MS) {
    if (rate.count >= RATE_LIMIT) {
      return c.json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, 429)
    }
    db.prepare('UPDATE otp_rate SET count = count + 1 WHERE email = ?').run(email)
  } else {
    db.prepare('INSERT OR REPLACE INTO otp_rate (email, count, window_start) VALUES (?, 1, ?)').run(email, now)
  }

  // crypto.getRandomValues, not Math.random: codes must be unpredictable.
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000
  const otp = String(100000 + n)
  db.prepare(
    'INSERT INTO auth_requests (id, email, otp_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(randomHex(16), email, await sha256(otp), now, now + OTP_TTL_MS)

  try {
    await sendOtpEmail(email, otp)
  } catch (err) {
    console.error('Failed to send OTP email:', err)
    return c.json({ error: 'Failed to send email. Check the server SMTP configuration.' }, 500)
  }
  return null
}

type Credentials = { email: string; authHash: string; legacyPassword: string; otp: string }
type CredBody = { email?: string; authHash?: string; legacyPassword?: string; otp?: string }

async function readCredentials(c: Context): Promise<Credentials | Response> {
  const body = await c.req.json<CredBody>().catch(() => ({}) as CredBody)
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@') || email.length > 254) return c.json({ error: 'Invalid email' }, 400)
  const authHash = body.authHash ?? ''
  if (!AUTH_HASH.test(authHash)) return c.json({ error: 'Invalid credentials format. Update your RokoPW app.' }, 400)
  return { email, authHash, legacyPassword: body.legacyPassword ?? '', otp: (body.otp ?? '').trim() }
}

/**
 * Check the password proof for an existing account. Returns an error response,
 * or null when it matches. Legacy accounts need `legacyPassword` once.
 */
async function checkPassword(c: Context, user: UserRow, cred: Credentials): Promise<Response | null> {
  if (!user.password_hash) return null // invited: chooses a password now
  if (user.kdf >= 1) {
    return (await verifyPassword(cred.authHash, user.password_hash))
      ? null
      : c.json({ error: 'Invalid email or password.' }, 401)
  }
  if (!cred.legacyPassword) {
    return c.json({ error: 'This account needs a one-time security upgrade.', code: 'legacy_password' }, 409)
  }
  return (await verifyPassword(cred.legacyPassword, user.password_hash))
    ? null
    : c.json({ error: 'Invalid email or password.' }, 401)
}

function blocked(c: Context, email: string): Response | null {
  if (mayAuthenticate(email)) return null
  if (userCount() === 0) return c.json({ error: SETUP_ERROR, code: 'setup_required' }, 403)
  return c.json({ error: getUser(email)?.status === 'disabled' ? DISABLED_ERROR : INVITE_ONLY_ERROR }, 403)
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Step 1: check the password proof, then email a one-time code.
authRoutes.post('/login', async (c) => {
  const cred = await readCredentials(c)
  if (cred instanceof Response) return cred
  const denied = blocked(c, cred.email)
  if (denied) return denied

  const user = getUser(cred.email)
  const newAccount = !user || !user.password_hash
  if (user) {
    const err = await checkPassword(c, user, cred)
    if (err) return err
  }

  const otpError = await issueOtp(c, cred.email)
  if (otpError) return otpError
  return c.json({ otpRequired: true, newAccount })
})

// ── POST /api/auth/verify ─────────────────────────────────────────────────────
// Step 2: verify the code (and the password proof again), then issue a session.
authRoutes.post('/verify', async (c) => {
  const cred = await readCredentials(c)
  if (cred instanceof Response) return cred
  if (!/^\d{6}$/.test(cred.otp)) return c.json({ error: 'Enter the 6-digit code.' }, 400)

  const now = Date.now()
  const req = db
    .prepare(
      `SELECT id FROM auth_requests
       WHERE email = ? AND otp_hash = ? AND expires_at > ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(cred.email, await sha256(cred.otp), now) as { id: string } | undefined
  if (!req) return c.json({ error: 'Invalid or expired code.' }, 401)

  const denied = blocked(c, cred.email)
  if (denied) return denied

  const user = getUser(cred.email)
  let userId: string
  let isNew = false
  if (!user) {
    // The first account on the server, or an email in ADMIN_EMAILS, is an admin.
    const role = userCount() === 0 || configuredAdminEmails().has(cred.email) ? 'admin' : 'member'
    userId = randomHex(16)
    db.prepare(
      "INSERT INTO users (id, email, password_hash, kdf, role, status, created_at) VALUES (?, ?, ?, 1, ?, 'active', ?)",
    ).run(userId, cred.email, await hashPassword(cred.authHash), role, now)
    isNew = true
  } else {
    const err = await checkPassword(c, user, cred)
    if (err) return err
    if (!user.password_hash || user.kdf < 1) {
      // Invited account choosing its password, or a legacy account upgrading.
      db.prepare("UPDATE users SET password_hash = ?, kdf = 1, status = 'active' WHERE id = ?").run(
        await hashPassword(cred.authHash),
        user.id,
      )
    }
    userId = user.id
  }

  db.prepare('UPDATE auth_requests SET used = 1 WHERE id = ?').run(req.id)
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userId)

  const session = await issueSession(userId)
  audit({ id: userId, email: cred.email }, isNew ? 'account.created' : 'auth.sign_in')
  return c.json(session)
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Profile plus this user's key pair (the private key is encrypted client-side).
authRoutes.get('/me', requireAuth, (c) => {
  const row = db
    .prepare('SELECT id, email, name, role, status, public_key, encrypted_private_key FROM users WHERE id = ?')
    .get(c.get('user').id) as {
    id: string
    email: string
    name: string | null
    role: string
    status: string
    public_key: string | null
    encrypted_private_key: string | null
  }
  return c.json({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    publicKey: row.public_key,
    encryptedPrivateKey: row.encrypted_private_key ? JSON.parse(row.encrypted_private_key) : null,
  })
})

// ── PUT /api/auth/keys ────────────────────────────────────────────────────────
// Store this user's key pair. Only allowed once: replacing a public key would
// break every vault already shared with it.
type KeysBody = { publicKey?: string; encryptedPrivateKey?: { iv?: string; ciphertext?: string } }
authRoutes.put('/keys', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<KeysBody>().catch(() => ({}) as KeysBody)
  const epk = body.encryptedPrivateKey
  if (!isB64(body.publicKey, 2048) || !epk || !isB64(epk.iv, 64) || !isB64(epk.ciphertext, 8192)) {
    return c.json({ error: 'Invalid key payload' }, 400)
  }
  const res = db
    .prepare('UPDATE users SET public_key = ?, encrypted_private_key = ? WHERE id = ? AND public_key IS NULL')
    .run(body.publicKey, JSON.stringify({ iv: epk.iv, ciphertext: epk.ciphertext }), user.id)
  if (res.changes === 0) return c.json({ error: 'Keys are already set up for this account.' }, 409)
  audit(user, 'account.keys_created')
  return c.json({ ok: true })
})

// ── DELETE /api/auth/session ──────────────────────────────────────────────────
authRoutes.delete('/session', requireAuth, async (c) => {
  const token = (c.req.header('Authorization') ?? '').slice(7)
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(await sha256(token))
  return c.json({ ok: true })
})
