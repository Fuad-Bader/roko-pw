import nodemailer from 'nodemailer'

// MAIL_LOG=true prints emails to the server console instead of sending them.
// For local development and tests only: login codes appear in the log.
const MAIL_LOG = (process.env.MAIL_LOG ?? '').trim().toLowerCase() === 'true'

/** How email is delivered: printed to the log, sent over SMTP, or not set up. */
export function mailMode(): 'log' | 'smtp' | 'unconfigured' {
  if (MAIL_LOG) return 'log'
  return process.env.SMTP_HOST ? 'smtp' : 'unconfigured'
}

function transport() {
  if (MAIL_LOG) return nodemailer.createTransport({ jsonTransport: true })
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

const FROM = process.env.SMTP_FROM ?? 'RokoPW <noreply@localhost>'
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:4567').replace(/\/$/, '')

async function send(message: { to: string; subject: string; text: string; html: string }) {
  const info = await transport().sendMail({ from: FROM, ...message })
  if (MAIL_LOG) {
    console.log(`[mail] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}\n[/mail]`)
  }
  return info
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Roko brand: ink #0E1116, paper #F7F5F0, ember #FF5A1F.
function layout(title: string, body: string): string {
  return `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0E1116">
      <p style="font:500 11px/1 monospace;letter-spacing:.12em;text-transform:uppercase;color:#C2390A;margin:0 0 12px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#FF5A1F;margin-right:6px"></span>RokoPW
      </p>
      <h2 style="margin:0 0 16px;font-size:22px">${title}</h2>
      ${body}
      <p style="color:#5B6472;font-size:12px;margin-top:24px">Server: <a style="color:#C2390A" href="${esc(PUBLIC_URL)}">${esc(PUBLIC_URL)}</a></p>
    </div>`
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const minutes = process.env.OTP_TTL_MINUTES ?? 15
  await send({
    to: email,
    subject: 'Your RokoPW sign-in code',
    text: `Your sign-in code is: ${otp}\n\nThis code expires in ${minutes} minutes.\nIf you did not request this, you can ignore this email.`,
    html: layout(
      'Your sign-in code',
      `<div style="font:700 32px/1 monospace;letter-spacing:.25em;background:#0E1116;color:#F7F5F0;padding:16px 22px;border-radius:14px;display:inline-block">${esc(otp)}</div>
       <p style="color:#5B6472;font-size:14px">Expires in ${esc(String(minutes))} minutes. If you did not request this, you can ignore it.</p>`,
    ),
  })
}

export async function sendUserAddedEmail(toEmail: string, adminEmail: string): Promise<void> {
  await send({
    to: toEmail,
    subject: 'You have been added to RokoPW',
    text: [
      `${adminEmail} added you to the RokoPW server at ${PUBLIC_URL}.`,
      '',
      'Open RokoPW, choose "Sign in to your organization", enter this server address and your email,',
      'and choose a password. Your password never leaves your device.',
    ].join('\n'),
    html: layout(
      'You have been added to RokoPW',
      `<p><strong>${esc(adminEmail)}</strong> added you to your organization's RokoPW server.</p>
       <p>Open RokoPW, choose <strong>Sign in to your organization</strong>, enter the server address below and this email, then choose a password. Your password never leaves your device.</p>`,
    ),
  })
}

export async function sendVaultWriteNotification(
  toEmails: string[],
  writerEmail: string,
  vaultName: string,
): Promise<void> {
  if (toEmails.length === 0) return
  await send({
    to: toEmails.join(', '),
    subject: `"${vaultName}" was updated by ${writerEmail}`,
    text: `${writerEmail} saved changes to the vault "${vaultName}" on your RokoPW server.`,
    html: layout(
      'Vault updated',
      `<p><strong>${esc(writerEmail)}</strong> saved changes to the vault <strong>${esc(vaultName)}</strong>.</p>`,
    ),
  })
}

export async function sendTestEmail(toEmail: string): Promise<void> {
  await send({
    to: toEmail,
    subject: 'RokoPW test email',
    text: 'Email from your RokoPW server works. Sign-in codes and invitations will arrive like this one.',
    html: layout(
      'Email works',
      '<p>Your RokoPW server can send email. Sign-in codes and invitations will arrive like this one.</p>',
    ),
  })
}
