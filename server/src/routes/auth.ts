import { Hono, type Context } from "hono";
import { db } from "../db.js";
import { sendOtpEmail } from "../email.js";
import {
  requireAuth,
  sha256,
  randomHex,
  hashPassword,
  verifyPassword,
} from "../middleware/auth.js";

const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MINUTES ?? "15") * 60 * 1000;
const SESSION_TTL_MS =
  parseInt(process.env.SESSION_TTL_DAYS ?? "30") * 86400 * 1000;
// Max OTP requests per email per 15-minute window
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
// Minimum account password length (enforced server-side too).
const MIN_PASSWORD = 8;

// Whether brand-new emails (no account, no pending invite) may enroll
// themselves. Set ALLOW_SIGNUPS=false in the server's .env to run an
// invite-only server — existing users and invited emails can still sign in.
const ALLOW_SIGNUPS =
  (process.env.ALLOW_SIGNUPS ?? "true").trim().toLowerCase() !== "false";

// An email may authenticate if signups are open, or it is already known to
// the server: it has an account, or a pending (unexpired) invite.
function mayAuthenticate(email: string): boolean {
  if (ALLOW_SIGNUPS) return true;
  const existing = db.prepare("SELECT 1 FROM users WHERE email = ?").get(email);
  if (existing) return true;
  const invited = db
    .prepare(
      "SELECT 1 FROM vault_invites WHERE invited_email = ? AND accepted = 0 AND expires_at > ?",
    )
    .get(email, Date.now());
  return !!invited;
}

const INVITE_ONLY_ERROR =
  "This server is invite-only. Ask an admin to invite you.";

export const authRoutes = new Hono();

// Generate, store and email a fresh OTP for `email`. Returns an error response
// (rate-limit / SMTP failure) or null on success. Applies per-email rate limit.
async function issueOtp(c: Context, email: string): Promise<Response | null> {
  const now = Date.now();
  const rate = db
    .prepare("SELECT count, window_start FROM otp_rate WHERE email = ?")
    .get(email) as { count: number; window_start: number } | undefined;

  if (rate && now - rate.window_start < RATE_WINDOW_MS) {
    if (rate.count >= RATE_LIMIT) {
      return c.json(
        { error: "Too many login attempts. Try again in 15 minutes." },
        429,
      );
    }
    db.prepare("UPDATE otp_rate SET count = count + 1 WHERE email = ?").run(email);
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO otp_rate (email, count, window_start) VALUES (?, 1, ?)",
    ).run(email, now);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await sha256(otp);
  const id = randomHex(16);
  db.prepare(
    "INSERT INTO auth_requests (id, email, otp_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, email, otpHash, now, now + OTP_TTL_MS);

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return c.json(
      { error: "Failed to send email. Check server SMTP configuration." },
      500,
    );
  }
  return null;
}

// ── POST /api/auth/login  ─────────────────────────────────────────────────────
// Step 1 of sign-in: verify email + password, then email a one-time code.
// Establishing a new session always requires email verification, so a valid
// password is answered with `{ otpRequired: true }` rather than a session.
authRoutes.post("/login", async (c) => {
  const body = await c.req
    .json<{ email?: string; password?: string }>()
    .catch(() => ({ email: undefined, password: undefined }));
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !email.includes("@"))
    return c.json({ error: "Invalid email" }, 400);
  if (!password) return c.json({ error: "Password required" }, 400);

  // Enrollment policy: don't send a code to an email that can't sign in.
  if (!mayAuthenticate(email))
    return c.json({ error: INVITE_ONLY_ERROR }, 403);

  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email) as { id: string; password_hash: string | null } | undefined;

  // A brand-new account, or a legacy account that never set a password, will
  // set its password after the email is verified.
  let newAccount = false;
  if (!user || !user.password_hash) {
    if (password.length < MIN_PASSWORD)
      return c.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters.` },
        400,
      );
    newAccount = true;
  } else {
    if (!(await verifyPassword(password, user.password_hash)))
      return c.json({ error: "Invalid email or password." }, 401);
  }

  const otpError = await issueOtp(c, email);
  if (otpError) return otpError;

  return c.json({ otpRequired: true, newAccount });
});

// ── POST /api/auth/verify  ────────────────────────────────────────────────────
// Step 2 of sign-in: verify the OTP (and password again), then issue a session.
// For new accounts this also creates the account with the given password.
authRoutes.post("/verify", async (c) => {
  const body = await c.req
    .json<{ email?: string; otp?: string; password?: string }>()
    .catch(() => ({ email: undefined, otp: undefined, password: undefined }));
  const email = (body.email ?? "").trim().toLowerCase();
  const otp = (body.otp ?? "").trim();
  const password = body.password ?? "";
  if (!email || !otp) return c.json({ error: "Email and OTP required" }, 400);
  if (!password) return c.json({ error: "Password required" }, 400);

  const otpHash = await sha256(otp);
  const now = Date.now();

  const req = db
    .prepare(
      `SELECT id FROM auth_requests
       WHERE email = ? AND otp_hash = ? AND expires_at > ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, otpHash, now) as { id: string } | undefined;

  if (!req) return c.json({ error: "Invalid or expired code." }, 401);

  // Enforce enrollment policy again at verify time (defense in depth — the
  // policy or invites may have changed since the code was requested).
  if (!mayAuthenticate(email))
    return c.json({ error: INVITE_ONLY_ERROR }, 403);

  // Resolve the user, creating or setting the password as needed.
  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email) as { id: string; password_hash: string | null } | undefined;

  let userId: string;
  if (!user) {
    if (password.length < MIN_PASSWORD)
      return c.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters.` },
        400,
      );
    userId = randomHex(16);
    db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run(userId, email, await hashPassword(password), now);
  } else if (!user.password_hash) {
    if (password.length < MIN_PASSWORD)
      return c.json(
        { error: `Password must be at least ${MIN_PASSWORD} characters.` },
        400,
      );
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      await hashPassword(password),
      user.id,
    );
    userId = user.id;
  } else {
    if (!(await verifyPassword(password, user.password_hash)))
      return c.json({ error: "Invalid email or password." }, 401);
    userId = user.id;
  }

  // Mark the code used only once we're committed to issuing a session.
  db.prepare("UPDATE auth_requests SET used = 1 WHERE id = ?").run(req.id);

  // Create session
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const sessionId = randomHex(16);
  db.prepare(
    "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(sessionId, tokenHash, userId, now, now + SESSION_TTL_MS);

  return c.json({ token, expiresAt: now + SESSION_TTL_MS });
});

// ── GET /api/auth/me  ─────────────────────────────────────────────────────────
authRoutes.get("/me", requireAuth, (c) => {
  return c.json(c.get("user"));
});

// ── DELETE /api/auth/session  ─────────────────────────────────────────────────
authRoutes.delete("/session", requireAuth, async (c) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.slice(7);
  const tokenHash = await sha256(token);
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  return c.json({ ok: true });
});
