# Build from the repository root (the image includes the admin console):
#   docker build -f server/Dockerfile .
# or use server/docker-compose.yml.

# ── 1. Admin console (apps/admin → static files) ─────────────────────────────
FROM node:22-alpine AS admin
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
# Every workspace's package.json must exist for npm ci to accept the lockfile.
COPY apps/landing/package.json ./apps/landing/package.json
COPY apps/vault/package.json ./apps/vault/package.json
RUN npm ci --workspace @roko/admin --include-workspace-root
RUN npm run build -w @roko/admin

# ── 2. Server (TypeScript → dist/) ───────────────────────────────────────────
FROM node:22-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# ── 3. Runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=server /app/dist ./dist
COPY --from=admin /repo/apps/admin/dist ./admin
VOLUME ["/data"]
ENV DATA_DIR=/data \
    ADMIN_DIR=/app/admin \
    NODE_ENV=production
EXPOSE 4567
CMD ["node", "dist/index.js"]
