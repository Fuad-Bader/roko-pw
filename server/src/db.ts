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
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT,
      created_at  INTEGER NOT NULL
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
}
