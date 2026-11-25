# RokoPW

A zero-knowledge password manager for developers and teams: logins, SSH keys,
RDP and VPN credentials, and custom credential templates. Everything is
encrypted on the device; servers only ever store ciphertext.

## Repository layout

This is an npm workspaces monorepo. Each app builds and deploys on its own.

| Path | What it is | Builds to | Deploy |
| --- | --- | --- | --- |
| `apps/landing` | Marketing site (Next.js, static export) | `apps/landing/out/` | Any static host / CDN |
| `apps/vault` | Vault web app (Vite + React) | `apps/vault/dist/` | Any static host / CDN |
| `apps/admin` | Org admin console (Vite + React) | `apps/admin/dist/` | Bundled into the org server image, served at `/admin` |
| `server` | Org API server (Hono + SQLite) | `server/dist/` | Docker image (`server/Dockerfile`), includes the admin console |
| `apps/desktop` | Desktop app (Electron) | installers | Downloads on the landing site |
| `apps/extension` | Browser extension (personal vaults, autofill) | as-is | Browser web stores / unpacked |
| `packages/ui` | Roko design system: tokens, styles, fonts, logo, buttons | (source) | used by every app |
| `packages/vault-core` | Crypto, org API client, templates, vault provider and screens | (source) | vault, admin, desktop |

`apps/desktop`, `apps/extension` and `server` keep their own dependencies
(`npm install` inside each); everything else installs from the root.

## Development

```bash
npm install                 # all workspaces
npm run dev:landing         # http://localhost:3000
npm run dev:vault           # http://localhost:3001
npm run dev:admin           # http://localhost:3002/admin/  (talks to VITE_ORG_SERVER, default http://localhost:4567)

cd server && npm install
cp .env.example .env        # set MAIL_LOG=true locally to see sign-in codes in the terminal
npm run dev                 # http://localhost:4567 (API) and /admin once apps/admin is built
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Configuration

| App | Variable | Purpose |
| --- | --- | --- |
| landing | `NEXT_PUBLIC_VAULT_URL` | Where "Open vault" / "Sign in" link to (the deployed vault app) |
| vault | `VITE_ORG_SERVER` | Optional: prefills the org server address on sign-in |
| admin | `VITE_ORG_SERVER` | Development only; in production the console manages the server it is served from |
| server | see `server/.env.example` | SMTP, admins, sign-up policy, data directory |

## Deploying

- **Landing:** `npm run build:landing`, upload `apps/landing/out/`.
- **Vault:** `npm run build:vault`, upload `apps/vault/dist/` (serve `index.html` for unknown paths).
- **Org server + admin console:** `docker compose -f server/docker-compose.yml up -d --build`
  (the build context is the repository root so the image can include `apps/admin`).

See `server/README.md` for how org access, keys and permissions work.
