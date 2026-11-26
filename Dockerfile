# One Dockerfile for every deployable app. Pick one with --target:
#
#   docker build --target landing -t roko-landing .   # marketing site (nginx)
#   docker build --target vault   -t roko-vault   .   # vault web app (nginx)
#   docker build --target server  -t roko-server  .   # org API + admin console
#
# or build and run all three with docker-compose.yml.

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

# ── Workspace dependencies (landing, vault, admin, packages/*) ───────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
# Every workspace's package.json must exist for npm ci to accept the lockfile.
COPY apps/landing/package.json apps/landing/package.json
COPY apps/vault/package.json   apps/vault/package.json
COPY apps/admin/package.json   apps/admin/package.json
COPY packages/ui/package.json         packages/ui/package.json
COPY packages/vault-core/package.json packages/vault-core/package.json
RUN npm ci
COPY packages ./packages

# ── Landing site (Next.js static export → apps/landing/out) ──────────────────
FROM deps AS landing-build
ARG NEXT_PUBLIC_VAULT_URL
ENV NEXT_PUBLIC_VAULT_URL=${NEXT_PUBLIC_VAULT_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY apps/landing ./apps/landing
RUN npm run build -w @roko/landing

# ── Vault web app (Vite → apps/vault/dist) ───────────────────────────────────
FROM deps AS vault-build
ARG VITE_ORG_SERVER
ENV VITE_ORG_SERVER=${VITE_ORG_SERVER}
COPY apps/vault ./apps/vault
RUN npm run build -w @roko/vault

# ── Admin console (Vite → apps/admin/dist, served by the org server) ─────────
FROM deps AS admin-build
COPY apps/admin ./apps/admin
RUN npm run build -w @roko/admin

# ── Org server (TypeScript → dist/; keeps its own dependencies) ──────────────
FROM ${NODE_IMAGE} AS server-build
WORKDIR /app
COPY apps/server/package.json apps/server/package-lock.json ./
RUN npm ci
COPY apps/server/tsconfig.json ./
COPY apps/server/src ./src
RUN npm run build

FROM ${NODE_IMAGE} AS server-deps
WORKDIR /app
COPY apps/server/package.json apps/server/package-lock.json ./
RUN npm ci --omit=dev

# ═════════════════════════════ Runtime images ═══════════════════════════════

FROM ${NGINX_IMAGE} AS landing
COPY docker/nginx/landing.conf /etc/nginx/conf.d/default.conf
COPY --from=landing-build /repo/apps/landing/out /usr/share/nginx/html
EXPOSE 80

FROM ${NGINX_IMAGE} AS vault
COPY docker/nginx/vault.conf /etc/nginx/conf.d/default.conf
COPY --from=vault-build /repo/apps/vault/dist /usr/share/nginx/html
EXPOSE 80

FROM ${NODE_IMAGE} AS server
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    ADMIN_DIR=/app/admin
COPY apps/server/package.json ./
COPY --from=server-deps  /app/node_modules ./node_modules
COPY --from=server-build /app/dist ./dist
COPY --from=admin-build  /repo/apps/admin/dist ./admin
VOLUME ["/data"]
EXPOSE 4567
CMD ["node", "dist/index.js"]
