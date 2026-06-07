'use client'

import { useEffect, useState } from 'react'
import { Download01, Monitor01 } from '@untitledui/icons'

type OS = 'windows' | 'mac' | 'linux' | 'other'

interface Artifact {
  os: 'windows' | 'mac' | 'linux'
  file: string
  url: string
  size: number
}

interface Manifest {
  version: string
  builtAt: string
  artifacts: Artifact[]
}

const OS_LABEL: Record<Artifact['os'], string> = {
  windows: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
}

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  if (platform.includes('win') || ua.includes('windows')) return 'windows'
  if (platform.includes('mac') || ua.includes('mac os')) return 'mac'
  if (platform.includes('linux') || ua.includes('linux')) return 'linux'
  return 'other'
}

function formatSize(bytes: number): string {
  return `${(bytes / 1e6).toFixed(1)} MB`
}

export function DownloadDesktop() {
  const [os, setOs] = useState<OS>('other')
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const finish = (m: Manifest | null) => {
      if (cancelled) return
      setManifest(m)
      setOs(detectOS())
      setLoaded(true)
    }
    fetch('/downloads/downloads.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Manifest | null) => finish(m))
      .catch(() => finish(null))
    return () => { cancelled = true }
  }, [])

  const artifacts = manifest?.artifacts ?? []
  // Prefer a build matching the visitor's OS; otherwise offer the first available.
  const primary = artifacts.find((a) => a.os === os) ?? artifacts[0] ?? null
  const others = artifacts.filter((a) => a !== primary)

  if (loaded && !primary) {
    // Nothing has been built/published yet.
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
        <Monitor01 size={18} /> Desktop app coming soon
      </span>
    )
  }

  const matchesOS = primary && primary.os === os

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <a
        href={primary?.url ?? '#'}
        download
        aria-disabled={primary ? undefined : 'true'}
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
          opacity: primary ? 1 : 0.6,
          pointerEvents: primary ? 'auto' : 'none',
          boxShadow:
            '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
        }}
      >
        <Download01 size={18} />
        {primary ? `Download for ${OS_LABEL[primary.os]}` : 'Loading…'}
      </a>

      {primary && (
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          {manifest?.version ? `v${manifest.version} · ` : ''}
          {formatSize(primary.size)}
          {!matchesOS && os !== 'other' ? ` · ${OS_LABEL[primary.os]} build` : ''}
        </span>
      )}

      {others.length > 0 && (
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', display: 'inline-flex', gap: 10 }}>
          Also for:
          {others.map((a) => (
            <a
              key={a.os}
              href={a.url}
              download
              style={{ color: 'var(--color-bg-brand-solid)', textDecoration: 'none', fontWeight: 500 }}
            >
              {OS_LABEL[a.os]}
            </a>
          ))}
        </span>
      )}
    </div>
  )
}
