import { Hono } from "hono";
import { db } from "../db.js";
import { sendOtpEmail } from "../email.js";
import { requireAuth, sha256, randomHex } from "../middleware/auth.js";

const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MINUTES ?? "15") * 60 * 1000;
const SESSION_TTL_MS =
  parseInt(process.env.SESSION_TTL_DAYS ?? "30") * 86400 * 1000;
// Max OTP requests per email per 15-minute window
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export const authRoutes = new Hono();

// ── POST /api/auth/request  ───────────────────────────────────────────────────
// Send a 6-digit OTP to the given email address.
authRoutes.post("/request", async (c) => {
  const body = await c.req
    .json<{ email?: string }>()
    .catch(() => ({ email: undefined }));
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@"))
    return c.json({ error: "Invalid email" }, 400);

  // Rate limiting
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
    db.prepare("UPDATE otp_rate SET count = count + 1 WHERE email = ?").run(
      email,
    );
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO otp_rate (email, count, window_start) VALUES (?, 1, ?)",
    ).run(email, now);
  }

  // Generate OTP
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

  return c.json({ ok: true });
});

// ── POST /api/auth/verify  ────────────────────────────────────────────────────
// Verify OTP and return a session token.
authRoutes.post("/verify", async (c) => {
  const body = await c.req
    .json<{ email?: string; otp?: string }>()
    .catch(() => ({ email: undefined, otp: undefined }));
  const email = (body.email ?? "").trim().toLowerCase();
  const otp = (body.otp ?? "").trim();
  if (!email || !otp) return c.json({ error: "Email and OTP required" }, 400);

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

  // Mark used
  db.prepare("UPDATE auth_requests SET used = 1 WHERE id = ?").run(req.id);

  // Upsert user
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  if (!user) {
    const uid = randomHex(16);
    db.prepare(
      "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)",
    ).run(uid, email, now);
    user = { id: uid };
  }

  // Create session
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const sessionId = randomHex(16);
  db.prepare(
    "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(sessionId, tokenHash, user.id, now, now + SESSION_TTL_MS);

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
