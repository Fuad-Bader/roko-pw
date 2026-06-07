'use client'

import { useEffect, useState } from 'react'
import { Download01, PuzzlePiece01 } from '@untitledui/icons'

interface ExtManifest {
  version: string
  builtAt: string
  file: string
  url: string
  size: number
}

function formatSize(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`
}

export function DownloadExtension() {
  const [manifest, setManifest] = useState<ExtManifest | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const finish = (m: ExtManifest | null) => {
      if (cancelled) return
      setManifest(m)
      setLoaded(true)
    }
    fetch('/downloads/extension.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: ExtManifest | null) => finish(m))
      .catch(() => finish(null))
    return () => {
      cancelled = true
    }
  }, [])

  if (loaded && !manifest) {
    // Nothing has been packed/published yet.
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 48,
          padding: '0 20px',
          borderRadius: 8,
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-tertiary)',
          fontSize: 16,
          fontWeight: 600,
          border: '1px solid var(--color-border-secondary)',
        }}
      >
        <PuzzlePiece01 size={18} /> Extension coming soon
      </span>
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <a
        href={manifest?.url ?? '#'}
        download
        aria-disabled={manifest ? undefined : 'true'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 48,
          padding: '0 20px',
          borderRadius: 8,
          background: 'var(--color-bg-brand-solid)',
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          textDecoration: 'none',
          opacity: manifest ? 1 : 0.6,
          pointerEvents: manifest ? 'auto' : 'none',
          boxShadow:
            '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
        }}
      >
        <Download01 size={18} />
        {manifest ? 'Download browser extension' : 'Loading…'}
      </a>

      {manifest && (
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          {manifest.version ? `v${manifest.version} · ` : ''}
          {formatSize(manifest.size)} · .zip
        </span>
      )}
    </div>
  )
}
