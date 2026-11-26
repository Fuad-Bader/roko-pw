/**
 * Serves the admin console (apps/admin, built to static files) at /admin.
 *
 * The console is a separate app; the server only hosts its files so every
 * self-hosted org gets it at https://<server>/admin without a second deployment.
 * Set ADMIN_DIR to the built files (the Docker image does). Without them the
 * server still runs; /admin just isn't available.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hono, MiddlewareHandler } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'

const here = dirname(fileURLToPath(import.meta.url))
// apps/server/src or apps/server/dist → apps/admin/dist (local development)
const ADMIN_DIR = resolve(process.env.ADMIN_DIR ?? join(here, '..', '..', 'admin', 'dist'))

// The console only talks to this server, so its policy can be strict.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React style attributes
  "img-src 'self' data:", // template icons are data: URLs
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.header('Content-Security-Policy', CSP)
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  // index.html must be revalidated so an upgraded console loads its new assets.
  if (!c.req.path.startsWith('/admin/assets/')) c.header('Cache-Control', 'no-cache')
}

export function mountAdminUi(app: Hono): boolean {
  const indexFile = join(ADMIN_DIR, 'index.html')
  if (!existsSync(indexFile)) {
    console.log(`Admin console not found at ${ADMIN_DIR} (build it with "npm run build:admin"); /admin is disabled.`)
    return false
  }
  const indexHtml = readFileSync(indexFile, 'utf8')

  app.use('/admin', securityHeaders)
  app.use('/admin/*', securityHeaders)
  app.get('/admin', (c) => c.redirect('/admin/', 301))
  // Hashed assets can be cached for a long time; index.html must not be.
  app.use('/admin/assets/*', async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use(
    '/admin/*',
    serveStatic({ root: ADMIN_DIR, rewriteRequestPath: (p) => p.replace(/^\/admin/, '') || '/' }),
  )
  // Single-page app: anything else under /admin gets the console's index.html.
  app.get('/admin/*', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.html(indexHtml)
  })
  console.log(`Admin console: /admin (from ${ADMIN_DIR})`)
  return true
}
