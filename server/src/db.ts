import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.DATA_DIR ?? './data'
mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(join(DATA_DIR, 'roko.db'))

export function initDb(): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      name          TEXT,
      password_hash TEXT,            -- scrypt hash; NULL for accounts that haven't set one yet
      created_at    INTEGER NOT NULL
    );

    -- One-time OTP codes (hashed) for passwordless login
    CREATE TABLE IF NOT EXISTS auth_requests (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      otp_hash    TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0
    );

    -- Rate-limit: track OTP request count per email per window
    CREATE TABLE IF NOT EXISTS otp_rate (
      email       TEXT PRIMARY KEY,
      count       INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );

    -- Session tokens (random 32-byte hex, stored hashed)
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      token_hash  TEXT UNIQUE NOT NULL,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    -- Vault metadata (name, timestamps)
    CREATE TABLE IF NOT EXISTS vaults (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'My Vault',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- The encrypted blob — server never sees plaintext
    CREATE TABLE IF NOT EXISTS vault_data (
      vault_id    TEXT PRIMARY KEY REFERENCES vaults(id) ON DELETE CASCADE,
      data        TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- Who can access which vault
    CREATE TABLE IF NOT EXISTS vault_members (
      vault_id    TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (vault_id, user_id)
    );

    -- Pending share invitations
    CREATE TABLE IF NOT EXISTS vault_invites (
      id              TEXT PRIMARY KEY,
      vault_id        TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
      invited_by      TEXT NOT NULL REFERENCES users(id),
      invited_email   TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'member',
      token           TEXT UNIQUE NOT NULL,
      created_at      INTEGER NOT NULL,
      expires_at      INTEGER NOT NULL,
      accepted        INTEGER NOT NULL DEFAULT 0
    );
  `)

  // ── Migrations for databases created before a column existed ────────────────
  // (CREATE TABLE IF NOT EXISTS won't add columns to an existing table.)
  addColumn('users', 'password_hash', 'TEXT')
  // Org model
  addColumn('users', 'role', "TEXT NOT NULL DEFAULT 'member'") // 'admin' | 'member'
  addColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'") // 'active' | 'invited' | 'disabled'
  // 0 = legacy (server received the raw password), 1 = client sends a derived auth hash
  addColumn('users', 'kdf', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('users', 'public_key', 'TEXT') // RSA-OAEP SPKI, base64
  addColumn('users', 'encrypted_private_key', 'TEXT') // JSON {iv, ciphertext}, encrypted client-side
  addColumn('users', 'last_login_at', 'INTEGER')
  // 'legacy' = shared vault-password vault from before the org model, 'org' = per-user keys
  addColumn('vaults', 'kind', "TEXT NOT NULL DEFAULT 'legacy'")
  addColumn('vaults', 'revision', 'INTEGER NOT NULL DEFAULT 0')
  addColumn('vaults', 'created_by', 'TEXT')
  // The vault key encrypted to this member's public key. NULL on an org vault = access
  // granted by an admin but not yet usable (the user hasn't created keys yet).
  addColumn('vault_members', 'wrapped_key', 'TEXT')
  addColumn('vault_members', 'can_write', 'INTEGER NOT NULL DEFAULT 1')
  addColumn('vault_members', 'can_export', 'INTEGER NOT NULL DEFAULT 0')

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      at          INTEGER NOT NULL,
      actor_id    TEXT,
      actor_email TEXT,
      action      TEXT NOT NULL,
      target      TEXT,
      details     TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log(at DESC);

    -- Org-wide settings chosen in the admin console (org name, sign-up policy,
    -- first-run setup state).
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  bootstrapAdmins()
}

function addColumn(table: string, column: string, decl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
}

/** Emails listed in ADMIN_EMAILS (comma-separated) are always org admins. */
export function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

// Make sure the org has an admin: promote ADMIN_EMAILS, and on an existing server
// with no admin yet, the earliest account (the person who set the server up).
function bootstrapAdmins() {
  const emails = configuredAdminEmails()
  for (const email of emails) {
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email)
  }
  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE role = 'admin' AND status != 'disabled'").get()
  if (!hasAdmin) {
    const first = db.prepare('SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1').get() as
      | { id: string; email: string }
      | undefined
    if (first) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(first.id)
      console.log(`No org admin found: promoted the first account (${first.email}) to admin.`)
    }
  }
}

/** Append to the audit log. Never throws: auditing must not break the request. */
export function audit(
  actor: { id: string; email: string } | null,
  action: string,
  target?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    db.prepare(
      'INSERT INTO audit_log (at, actor_id, actor_email, action, target, details) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(Date.now(), actor?.id ?? null, actor?.email ?? null, action, target ?? null, details ? JSON.stringify(details) : null)
  } catch (err) {
    console.error('audit failed', err)
  }
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  else db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function userCount(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

/**
 * Whether anyone may create an account. ALLOW_SIGNUPS in the environment wins
 * (and locks the switch in the admin console); otherwise the admin decides.
 */
export function signupPolicy(): { allowSignups: boolean; locked: boolean } {
  const env = (process.env.ALLOW_SIGNUPS ?? '').trim().toLowerCase()
  if (env === 'true' || env === 'false') return { allowSignups: env === 'true', locked: true }
  return { allowSignups: getSetting('allow_signups') === 'true', locked: false }
}
