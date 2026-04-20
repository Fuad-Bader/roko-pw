import nodemailer from 'nodemailer'

function transport() {
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

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  await transport().sendMail({
    from: FROM,
    to: email,
    subject: 'Your RokoPW login code',
    text: `Your login code is: ${otp}\n\nThis code expires in ${process.env.OTP_TTL_MINUTES ?? 15} minutes.\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#4f46e5">RokoPW Login</h2>
        <p>Your one-time login code is:</p>
        <div style="font-size:2.5rem;font-weight:700;letter-spacing:.25rem;color:#1e1b4b;background:#eef2ff;padding:1rem 1.5rem;border-radius:.5rem;display:inline-block">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:.875rem">
          Expires in ${process.env.OTP_TTL_MINUTES ?? 15} minutes. If you did not request this, you can safely ignore it.
        </p>
      </div>`,
  })
}

export async function sendInviteEmail(
  toEmail: string,
  inviterEmail: string,
  vaultName: string,
  inviteToken: string,
  vaultPassword: string,
): Promise<void> {
  const acceptUrl = `${PUBLIC_URL}/invite/${inviteToken}`
  await transport().sendMail({
    from: FROM,
    to: toEmail,
    subject: `${inviterEmail} shared a vault with you on RokoPW`,
    text: [
      `${inviterEmail} has invited you to access the vault "${vaultName}".`,
      '',
      `Server:        ${PUBLIC_URL}`,
      `Vault password: ${vaultPassword}`,
      '',
      `Accept the invitation: ${acceptUrl}`,
      '',
      'You will need the vault password above to decrypt and access this vault.',
      'Keep it somewhere safe — the server never stores it.',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#4f46e5">RokoPW — Vault Invitation</h2>
        <p><strong>${inviterEmail}</strong> has invited you to access the vault <strong>"${vaultName}"</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:1rem 0">
          <tr>
            <td style="padding:.5rem;color:#6b7280;font-size:.875rem">Server</td>
            <td style="padding:.5rem;font-family:monospace">${PUBLIC_URL}</td>
          </tr>
          <tr style="background:#fafafa">
            <td style="padding:.5rem;color:#6b7280;font-size:.875rem">Vault password</td>
            <td style="padding:.5rem;font-family:monospace;font-size:1.1rem;font-weight:700;color:#1e1b4b">${vaultPassword}</td>
          </tr>
        </table>
        <a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:white;padding:.75rem 1.5rem;border-radius:.5rem;text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
        <p style="color:#6b7280;font-size:.75rem;margin-top:1.5rem">
          You will need the vault password above when you open RokoPW and connect to this vault.
          The server never stores it — keep it safe.
        </p>
      </div>`,
  })
}

export async function sendInviteAcceptedEmail(
  toEmail: string,
  acceptedByEmail: string,
  vaultName: string,
): Promise<void> {
  await transport().sendMail({
    from: FROM,
    to: toEmail,
    subject: `${acceptedByEmail} joined your vault on RokoPW`,
    text: `${acceptedByEmail} has accepted your invitation and now has access to "${vaultName}".`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#4f46e5">RokoPW — Invite Accepted</h2>
        <p><strong>${acceptedByEmail}</strong> has accepted your invitation and now has access to the vault <strong>"${vaultName}"</strong>.</p>
        <p style="color:#6b7280;font-size:.875rem">Log in to <a href="${PUBLIC_URL}">${PUBLIC_URL}</a> to manage vault members.</p>
      </div>`,
  })
}

export async function sendVaultWriteNotification(
  toEmails: string[],
  writerEmail: string,
  vaultName: string,
): Promise<void> {
  if (toEmails.length === 0) return
  await transport().sendMail({
    from: FROM,
    to: toEmails.join(', '),
    subject: `"${vaultName}" was updated by ${writerEmail}`,
    text: `${writerEmail} saved changes to the shared vault "${vaultName}" on your RokoPW server.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#4f46e5">RokoPW — Vault Updated</h2>
        <p><strong>${writerEmail}</strong> saved changes to the shared vault <strong>"${vaultName}"</strong>.</p>
        <p style="color:#6b7280;font-size:.875rem">Server: <a href="${PUBLIC_URL}">${PUBLIC_URL}</a></p>
      </div>`,
  })
}
