'use client'

import { useEffect, useRef, useState } from 'react'

type Browser = 'chrome' | 'edge' | 'brave' | 'opera' | 'arc' | 'firefox' | 'other'

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent

  if (ua.includes('Edg/')) return 'edge'
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'opera'
  // Brave exposes a global flag
  if ((navigator as unknown as { brave?: { isBrave?: () => boolean } }).brave?.isBrave) return 'brave'
  // Arc sets a CSS variable — cheapest reliable detection
  if (getComputedStyle(document.documentElement).getPropertyValue('--arc-palette-title').trim())
    return 'arc'
  if (ua.includes('Firefox/')) return 'firefox'
  if (ua.includes('Chrome/')) return 'chrome'
  return 'other'
}

const BROWSER_META: Record<Browser, { label: string; icon: React.ReactNode; chromium: boolean }> = {
  chrome: {
    label: 'Add to Chrome',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="4.5" fill="#fff" />
        <path d="M12 7.5h9.2A10 10 0 1 0 7.05 19.5L11.6 12" stroke="#fff" strokeWidth="0" fill="none" />
        <path d="M12 7.5h9.2a10 10 0 0 0-9.2-6A10 10 0 0 0 2.8 7.5Z" fill="#EA4335" />
        <path d="M7.05 19.5A10 10 0 0 0 21.2 7.5H12l-4.95 8.57" fill="#34A853" />
        <path d="M11.6 12 7.05 19.5A10 10 0 0 1 2.8 7.5H12" fill="#FBBC05" />
        <circle cx="12" cy="12" r="4.5" fill="#fff" />
        <circle cx="12" cy="12" r="3.5" fill="#4285F4" />
      </svg>
    ),
    chromium: true,
  },
  edge: {
    label: 'Add to Edge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
        <path d="M21 12.5c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.49 0 4.74 1.01 6.37 2.63" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3.5 14.5c1.5 3 4.5 5 8.5 5 3 0 5.5-1.5 7-4" stroke="#0078D4" strokeWidth="0" fill="none"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M12 4a8.5 8.5 0 0 1 7.77 5H10a3 3 0 0 0 0 6h8.48A8.5 8.5 0 1 1 12 4Z" fill="#0078D4"/>
        <path d="M18 15H10a3 3 0 0 1 0-6h9.77c.15.64.23 1.31.23 2a8.46 8.46 0 0 1-.52 3H18Z" fill="#50E6FF" opacity=".5"/>
      </svg>
    ),
    chromium: true,
  },
  brave: {
    label: 'Add to Brave',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="#FB542B">
        <path d="M20.5 8.5 22 6l-1.5-.5L19 4l-1.5 1-1-.5L12 3l-4.5 1.5-1 .5L5 4 3.5 5.5 2 6l1.5 2.5-.5 2 .5 2L5 15l1 2 1.5 1.5L12 21l4.5-2.5L18 17l1-2 1.5-2.5.5-2-.5-2Z"/>
      </svg>
    ),
    chromium: true,
  },
  opera: {
    label: 'Add to Opera',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="#FF1B2D"/>
        <ellipse cx="12" cy="12" rx="4" ry="9" fill="#FF1B2D" stroke="#fff" strokeWidth="1.5"/>
      </svg>
    ),
    chromium: true,
  },
  arc: {
    label: 'Add to Arc',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none">
        <circle cx="12" cy="12" r="9" fill="url(#arcGrad)"/>
        <defs>
          <linearGradient id="arcGrad" x1="3" y1="3" x2="21" y2="21">
            <stop offset="0%" stopColor="#FF6B6B"/>
            <stop offset="100%" stopColor="#A855F7"/>
          </linearGradient>
        </defs>
        <path d="M8 16 12 8l4 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9.5 13.5h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    chromium: true,
  },
  firefox: {
    label: 'Add to Firefox',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="#FF9500"/>
        <circle cx="12" cy="12" r="5" fill="#FF3750"/>
      </svg>
    ),
    chromium: false,
  },
  other: {
    label: 'Install Extension',
    icon: <span>🧩</span>,
    chromium: false,
  },
}

// ─── Install instructions modal ───────────────────────────────────────────────

function Modal({ browser, onClose }: { browser: Browser; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const meta = BROWSER_META[browser]

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const chromiumSteps = [
    <>Open <strong className="text-white">{meta.label.replace('Add to ', '')}</strong> and navigate to <code className="rounded bg-zinc-800 px-1 text-indigo-300">chrome://extensions</code></>,
    <>Enable <strong className="text-white">Developer mode</strong> using the toggle in the top-right corner</>,
    <>Click <strong className="text-white">Load unpacked</strong> and select the <code className="rounded bg-zinc-800 px-1 text-indigo-300">extension/</code> folder from this project</>,
    <>The <strong className="text-white">Roko</strong> icon will appear in your toolbar — click it to get started</>,
  ]

  const firefoxSteps = [
    <>Open Firefox and navigate to <code className="rounded bg-zinc-800 px-1 text-indigo-300">about:debugging#/runtime/this-firefox</code></>,
    <>Click <strong className="text-white">Load Temporary Add-on…</strong></>,
    <>Select the <code className="rounded bg-zinc-800 px-1 text-indigo-300">extension/manifest.json</code> file from this project</>,
    <>The <strong className="text-white">Roko</strong> icon will appear in your toolbar</>,
  ]

  const steps = meta.chromium ? chromiumSteps : firefoxSteps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Install {meta.label.replace('Add to ', '')} Extension</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-zinc-400">{step}</p>
            </li>
          ))}
        </ol>

        <p className="mt-5 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-500">
          The extension will be published to browser stores soon. For now, load it in developer mode.
        </p>
      </div>
    </div>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  size?: 'sm' | 'lg'
}

export function InstallButton({ size = 'lg' }: Props) {
  const [browser, setBrowser] = useState<Browser>('other')
  const [open, setOpen] = useState(false)

  useEffect(() => { setBrowser(detectBrowser()) }, [])

  const meta = BROWSER_META[browser]

  const cls =
    size === 'lg'
      ? 'flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 active:scale-95'
      : 'flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100 active:scale-95'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        {meta.icon}
        {meta.label}
      </button>
      {open && <Modal browser={browser} onClose={() => setOpen(false)} />}
    </>
  )
}
