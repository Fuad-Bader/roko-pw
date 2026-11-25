# RokoPW org server

A self-hosted server for organizations. Admins manage people and vaults; members
read and write vaults directly on the server. The server never sees a password,
a vault key or any plaintext: it stores ciphertext and keys that are encrypted
on people's own devices.

## Run it

```bash
cp .env.example .env      # then set PUBLIC_URL, SMTP_* and ADMIN_EMAILS
npm install
npm run dev               # or: docker compose up -d
```

The first account created becomes the org admin (or anyone listed in
`ADMIN_EMAILS`). After that the server is invite-only unless
`ALLOW_SIGNUPS=true`.

## How access works

- **Accounts.** The app derives a key from the user's password on their device
  (PBKDF2, 600,000 rounds) and sends only a hash of that key to sign in. Signing
  in also needs a 6-digit code sent by email.
- **Keys.** Each user has an RSA-OAEP 3072 key pair. The private key is stored
  here encrypted with their password-derived key, so only they can use it.
- **Vaults.** Each vault has its own AES-256-GCM key. Granting access means the
  admin's app encrypts that key to the member's public key; the server stores
  one wrapped copy per member.
- **Permissions** are per member, per vault: *can edit* (enforced by the server:
  view-only members can't save) and *can download* (controls the app's download
  button; every attempt is written to the audit log). Anyone who can view an
  item can still copy what they see, so treat download permission as policy, not
  as a hard barrier.
- **Removing someone** from a vault in the admin console also rotates that
  vault's key, so a copy of the old key no longer decrypts anything.
- **Edits by several people** are safe: every save carries the revision it was
  based on; if someone saved in between, the app merges both changes and retries.

## Upgrading from the shared-password version

Existing data is kept. On startup the database is migrated in place:

- The earliest account becomes admin if there isn't one yet.
- Accounts upgrade to the new sign-in automatically the next time they sign in.
- Vaults that used a shared vault password are marked *legacy*. A member who
  knows that password opens it once from their vault list to convert it; from
  then on access is managed in the admin console.

## API overview

| Route | Who | Purpose |
| --- | --- | --- |
| `POST /api/auth/login`, `/verify` | anyone | password proof + emailed code → session |
| `GET /api/auth/me`, `PUT /api/auth/keys` | signed in | profile, one-time key setup |
| `GET /api/vaults`, `GET/PUT /api/vaults/:id` | members | list, read, save (with revision) |
| `POST /api/vaults/:id/export` | members | ask to download (checked + audited) |
| `/api/admin/users`, `/api/admin/vaults/*`, `/api/admin/audit` | admins | people, vaults, access, key rotation, audit log |
