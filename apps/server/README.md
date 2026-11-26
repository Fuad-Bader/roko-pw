# RokoPW org server

A self-hosted server for organizations. Admins manage people and vaults; members
read and write vaults directly on the server. The server never sees a password,
a vault key or any plaintext: it stores ciphertext and keys that are encrypted
on people's own devices.

## Run it

```bash
cp .env.example .env      # then set PUBLIC_URL and SMTP_*
npm install
npm run dev               # API at http://localhost:4567
# or, from the repository root: docker compose up -d --build server   (image also contains the admin console)
```

The admin console (`apps/admin`) is served at `/admin`. The Docker image builds
and includes it; when running from source, build it first with
`npm run build:admin` in the repository root (or set `ADMIN_DIR`).

## First-run setup

A new server prints a one-time **setup code** to its log:

```
  This server has not been set up yet.
  Open https://vault.acme.com/admin/ and enter this setup code:

      7KQ2-M9XD-4FTA
```

(`docker compose logs server` shows it.) Open `/admin` and the setup wizard
walks through:

1. **Organization**: the setup code and your org's name.
2. **Admin account**: your email and password. Your keys are created in the
   browser; the setup code stands in for the emailed sign-in code this once, so
   setup works before email is configured.
3. **Sign-in and email**: checks how email is delivered (send yourself a test)
   and whether the server is invite-only (default) or open for sign-up.
4. **Vaults**: create the first shared vaults.
5. **Your team**: invite people and choose their access to each vault.

The code stops working once the admin account exists. Until then, nobody can
create an account through the normal sign-in, so a fresh server can't be
claimed by whoever finds it first. If you close the wizard early, the console
resumes it after you sign in. Set `SETUP_TOKEN` to choose the code yourself.

Alternatively, list your email in `ADMIN_EMAILS`: that address can claim the
server by signing in with an emailed code, and the console then continues the
wizard at step 3. Everything chosen in the wizard can be changed later in the
console's **Settings** tab (`ALLOW_SIGNUPS` in the environment overrides the
sign-up setting).

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
| `GET /api/setup`, `POST /api/setup/check`, `/admin` | anyone (new server only) | first-run setup with the setup code |
| `POST /api/auth/login`, `/verify` | anyone | password proof + emailed code → session |
| `GET /api/auth/me`, `PUT /api/auth/keys` | signed in | profile, one-time key setup |
| `GET /api/vaults`, `GET/PUT /api/vaults/:id` | members | list, read, save (with revision) |
| `POST /api/vaults/:id/export` | members | ask to download (checked + audited) |
| `/api/admin/users`, `/api/admin/vaults/*`, `/api/admin/audit` | admins | people, vaults, access, key rotation, audit log |
| `/api/admin/settings`, `/api/admin/setup/complete` | admins | org name, sign-up policy, test email, finish setup |
