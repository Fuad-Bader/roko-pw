import type { NextRequest } from 'next/server'
import type { EncryptedVault } from '@/lib/types'

/**
 * In-memory vault store for demo / development.
 *
 * ⚠️  Data is lost on server restart.  For production, replace this Map with
 *     a real database (Postgres, Redis, etc.).  The server only ever stores the
 *     *encrypted* blob — it never has access to plaintext passwords.
 */
const store = new Map<string, EncryptedVault>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing vault id' }, { status: 400 })

  const vault = store.get(id) ?? null
  return Response.json(vault)
}

export async function POST(request: NextRequest) {
  let body: { id: string; vault: EncryptedVault }
  try {
    body = await request.json() as { id: string; vault: EncryptedVault }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, vault } = body
  if (!id || !vault) return Response.json({ error: 'Missing id or vault' }, { status: 400 })
  if (vault.version !== 1) return Response.json({ error: 'Unsupported vault version' }, { status: 400 })

  store.set(id, vault)
  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing vault id' }, { status: 400 })
  store.delete(id)
  return Response.json({ ok: true })
}
