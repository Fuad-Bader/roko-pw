import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth.js'
import { vaultRoutes } from './routes/vaults.js'
import { shareRoutes } from './routes/shares.js'
import { initDb } from './db.js'

const PORT = parseInt(process.env.PORT ?? '4567')

initDb()

const app = new Hono()

app.use(
  '*',
  cors({
    // Reflect origin so the extension (chrome-extension://) and desktop app work
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
)
app.use('*', logger())

// Health / server identity
app.get('/', (c) =>
  c.json({
    name: 'RokoPW Server',
    version: '0.1.0',
    // Clients use this to confirm they reached a RokoPW server
    kind: 'roko-pw-server',
  }),
)

app.route('/api/auth', authRoutes)
app.route('/api', vaultRoutes)     // /api/vaults/*
app.route('/api', shareRoutes)     // /api/vaults/:id/invite + /api/invite/*

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`RokoPW server running at http://localhost:${info.port}`)
  console.log(`Configure SMTP in .env to enable email (login codes + invite notifications).`)
})
