'use client'

import Link from 'next/link'
import { InstallButton } from './components/InstallButton'
import { DownloadDesktop } from './components/DownloadDesktop'
import { useTheme } from './components/ThemeProvider'
import { RokoLogo } from './components/RokoLogo'
import {
  ShieldTick,
  Fingerprint01,
  Lightning01,
  Users01,
  RefreshCw01,
  Cloud01,
  ArrowRight,
  Moon01,
  Sun,
} from '@untitledui/icons'
import './landing.css'

const FEATURES = [
  {
    icon: ShieldTick,
    title: 'Zero-knowledge by design',
    desc: 'Even we can\'t read your vault. AES-256-GCM with PBKDF2 key derivation. The server only ever sees ciphertext.',
  },
  {
    icon: Fingerprint01,
    title: 'Passkeys, native',
    desc: 'Generate, sync and use passkeys across every browser. Phishing-resistant by default — no extensions required.',
  },
  {
    icon: Lightning01,
    title: 'One-tap autofill',
    desc: 'Tap a field on any site. RokoPW detects it, fills it, and updates passwords when they change. No copy-paste.',
  },
  {
    icon: Users01,
    title: 'Share without leaking',
    desc: 'Send a credential to a teammate without ever revealing the value. Revoke any time. Audit who saw what.',
  },
  {
    icon: RefreshCw01,
    title: 'Watchtower alerts',
    desc: 'Continuously checks the dark web, breached sites and weak passwords. Tells you what to fix, in priority order.',
  },
  {
    icon: Cloud01,
    title: 'Sync that just works',
    desc: 'End-to-end encrypted sync across all browsers and devices. No conflicts, no losses, no compromises.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Encrypted on device',
    desc: 'Vault is encrypted with AES-256-GCM before any byte hits the network.',
  },
  {
    n: '02',
    title: 'Master key never leaves',
    desc: 'PBKDF2 derives a key only you know. We can\'t decrypt your vault, ever.',
  },
  {
    n: '03',
    title: 'Zero-knowledge sync',
    desc: 'Servers store ciphertext. We can see when you sync — never what.',
  },
  {
    n: '04',
    title: 'Open & audited',
    desc: 'Crypto core uses the browser\'s built-in Web Crypto API. No third-party libraries.',
  },
]

const PREVIEW_ITEMS = [
  { name: 'GitHub', user: 'alice@hey.com', c: '#0d1117', letters: 'GH' },
  { name: 'Stripe', user: 'team@aurora.co', c: '#635BFF', letters: 'S' },
  { name: 'Figma', user: 'alice@hey.com', c: '#F24E1E', letters: 'F' },
  { name: 'Linear', user: 'alice@aurora.co', c: '#5E6AD2', letters: 'L' },
  { name: 'Notion', user: 'alice@hey.com', c: '#000', letters: 'N' },
  { name: 'Vercel', user: 'alice@aurora.co', c: '#000', letters: 'V' },
]

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Download', href: '#download' },
]

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="lp">
      {/* ── Navigation ── */}
      <header className="lp-header">
        <div className="lp-container lp-nav">
          <Link href="/" aria-label="RokoPW home" style={{ textDecoration: 'none' }}>
            <RokoLogo size={32} tone="onDark" />
          </Link>

          <ul className="lp-nav-links">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>

          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon01 size={16} />}
            </button>
            <Link href="/vault" className="lp-btn lp-btn-sm lp-btn-ghost-light lp-nav-signin">
              Sign in
            </Link>
            <Link href="/vault" className="lp-btn lp-btn-sm lp-btn-primary">
              Get started free <ArrowRight />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero roko-blueprint">
        <div className="lp-container lp-hero-grid">
          <div>
            <p className="roko-eyebrow">Zero-knowledge password manager</p>
            <h1>
              Every password. <em>One secure home.</em>
            </h1>
            <p className="lp-hero-lead">
              RokoPW encrypts your logins, cards and notes end-to-end on your device, then syncs them
              everywhere you sign in. Free for individuals, forever.
            </p>
            <div className="lp-hero-actions">
              <InstallButton size="lg" />
              <Link href="/vault" className="lp-btn lp-btn-ghost-light">
                Open vault <ArrowRight />
              </Link>
            </div>
            <ul className="lp-hero-points">
              <li>No credit card</li>
              <li>Free for individuals</li>
              <li>Works offline</li>
            </ul>
          </div>

          <div className="roko-terminal" aria-hidden="true">
            <div className="roko-terminal-bar">
              <i />
              <i />
              <i />
              <span>roko — vault</span>
            </div>
            <div className="roko-terminal-body">
              <div>
                <span className="roko-t-prompt">$ </span>
                <span className="roko-t-cmd">roko vault status</span>
              </div>
              <div>
                <span className="roko-t-ok">✓</span> 248 items encrypted with AES-256-GCM
              </div>
              <div>
                <span className="roko-t-ok">✓</span> Key derived on device (PBKDF2, 600k rounds)
              </div>
              <div>
                <span className="roko-t-ok">✓</span> Passkeys ready for autofill
              </div>
              <div>
                <span className="roko-t-ok">✓</span> Encrypted sync up to date
              </div>
              <div style={{ height: '0.8em' }} />
              <div>
                <span className="roko-t-dim">master key   </span>
                <span className="roko-t-hi">never leaves this device</span>
              </div>
              <div>
                <span className="roko-t-dim">server sees  </span>
                <span className="roko-t-hi">0 passwords</span>
              </div>
              <div style={{ height: '0.8em' }} />
              <div>
                <span className="roko-t-prompt">$ </span>
                <span className="roko-cursor" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <div className="lp-strip">
        <div className="lp-container">
        <ul>
          <li>
            <strong>AES-256-GCM</strong> encryption
          </li>
          <li>
            <strong>PBKDF2-SHA256</strong> key derivation
          </li>
          <li>
            <strong>Web Crypto</strong> API only
          </li>
          <li>
            <strong>0</strong> passwords on the server
          </li>
        </ul>
        </div>
      </div>

      {/* ── Product preview ── */}
      <section className="lp-preview lp-light">
        <div className="lp-container">
          <div className="lp-preview-frame">
            <div className="lp-preview-app">
              <aside
                className="lp-preview-side"
                style={{
                  background: 'var(--color-bg-secondary)',
                  borderRight: '1px solid var(--color-border-secondary)',
                  padding: '16px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ padding: '0 6px 12px' }}>
                  <RokoLogo size={22} />
                </div>
                {[
                  { l: 'All items', n: 248, active: true },
                  { l: 'Logins', n: 184 },
                  { l: 'Cards', n: 6 },
                  { l: 'Secure notes', n: 24 },
                  { l: 'Shared', n: 31 },
                ].map((r) => (
                  <div
                    key={r.l}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 12px',
                      borderRadius: 999,
                      background: r.active ? 'var(--color-bg-primary)' : 'transparent',
                      boxShadow: r.active ? 'var(--roko-shadow-sm)' : 'none',
                      color: r.active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontSize: 13,
                      fontWeight: r.active ? 600 : 500,
                    }}
                  >
                    {r.active && (
                      <span style={{ width: 6, height: 6, borderRadius: 1.5, background: 'var(--ember-500)' }} />
                    )}
                    <span style={{ flex: 1 }}>{r.l}</span>
                    <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
                      {r.n}
                    </span>
                  </div>
                ))}
              </aside>

              <div style={{ padding: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ fontSize: 17, margin: 0 }}>All items</h3>
                  <span className="lp-btn lp-btn-sm lp-btn-primary" style={{ fontSize: 13, pointerEvents: 'none' }}>
                    + New
                  </span>
                </div>
                <div className="lp-preview-grid">
                  {PREVIEW_ITEMS.map((r) => (
                    <div
                      key={r.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: '1px solid var(--color-border-secondary)',
                        borderRadius: 14,
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background: r.c,
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {r.letters}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                        <div
                          style={{
                            font: '400 11px/1.5 var(--font-mono)',
                            color: 'var(--color-text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.user}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="lp-section lp-light">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="roko-eyebrow">Features</p>
            <h2>
              Built around how you <em>actually</em> work.
            </h2>
            <p>Six things every password manager should do well, and we&apos;ve spent years getting them right.</p>
          </div>

          <div className="lp-cards">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <article key={f.title} className="lp-card">
                  <span className="lp-card-icon">
                    <Icon />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section id="security" className="lp-section lp-section-alt lp-light">
        <div className="lp-container lp-split">
          <div>
            <p className="roko-eyebrow">Security</p>
            <h2>
              Encrypted <em>before</em> it leaves your device.
            </h2>
            <p style={{ fontSize: '1.15rem', color: 'var(--color-text-tertiary)', marginBottom: 32 }}>
              Your master password is the only key to your vault, and we never see it. We use the
              browser&apos;s built-in Web Crypto API; no third-party crypto libraries.
            </p>
            <ul className="lp-checks">
              {[
                { t: 'AES-256-GCM with PBKDF2', d: 'Industry-leading encryption. Open-sourced and reproducible.' },
                { t: 'Browser Web Crypto API', d: 'No third-party libraries. Trust the platform, trust the math.' },
                { t: 'Offline-first design', d: 'Works entirely offline. Server access is optional, never required.' },
              ].map((r) => (
                <li key={r.t}>
                  <strong>{r.t}</strong>
                  <span>{r.d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="roko-terminal">
            <div className="roko-terminal-bar">
              <i />
              <i />
              <i />
              <span>lib/crypto.ts</span>
            </div>
            <div className="roko-terminal-body">
              <pre className="lp-code">
                <span className="roko-t-prompt">async function</span> <span className="roko-t-cmd">encrypt</span>(vault, masterPassword) {'{\n'}
                {'  '}<span className="roko-t-prompt">const</span> salt = crypto.getRandomValues(<span className="roko-t-prompt">new</span> Uint8Array(16)){'\n'}
                {'  '}<span className="roko-t-prompt">const</span> key = <span className="roko-t-prompt">await</span> crypto.subtle.deriveKey({'\n'}
                {'    '}{'{'} name: <span className="roko-t-ok">&quot;PBKDF2&quot;</span>, salt, iterations: <span className="roko-t-hi">600_000</span>, hash: <span className="roko-t-ok">&quot;SHA-256&quot;</span> {'}'},{'\n'}
                {'    '}<span className="roko-t-prompt">await</span> importKey(masterPassword),{'\n'}
                {'    '}{'{'} name: <span className="roko-t-ok">&quot;AES-GCM&quot;</span>, length: <span className="roko-t-hi">256</span> {'}'},{'\n'}
                {'    '}<span className="roko-t-prompt">false</span>, [<span className="roko-t-ok">&quot;encrypt&quot;</span>]{'\n'}
                {'  '}){'\n'}
                {'  '}<span className="roko-t-prompt">const</span> iv = crypto.getRandomValues(<span className="roko-t-prompt">new</span> Uint8Array(12)){'\n'}
                {'  '}<span className="roko-t-prompt">const</span> cipher = <span className="roko-t-prompt">await</span> crypto.subtle.encrypt({'{'} name: <span className="roko-t-ok">&quot;AES-GCM&quot;</span>, iv {'}'}, key, vault){'\n'}
                {'  '}<span className="roko-t-prompt">return</span> {'{'} salt, iv, cipher {'}'}{'\n'}
                {'  '}<span className="roko-t-dim">{'// → the server only ever sees ciphertext'}</span>{'\n'}
                {'}'}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-section-dark">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="roko-eyebrow">How it works</p>
            <h2>
              How RokoPW <em>protects</em> you.
            </h2>
            <p>Four layers between an attacker and your data. Each independently verifiable.</p>
          </div>

          <div className="lp-pillars">
            {STEPS.map((s) => (
              <div key={s.n} className="lp-pillar">
                <p className="lp-pillar-label">Layer {s.n}</p>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download desktop app ── */}
      <section id="download" className="lp-section lp-light">
        <div className="lp-container">
          <div className="lp-section-head lp-center" style={{ textAlign: 'center' }}>
            <p className="roko-eyebrow">Desktop app</p>
            <h2>
              Your vault, <em>native</em> on your desktop.
            </h2>
            <p>
              The same zero-knowledge vault, packaged as a standalone app. Your data is stored encrypted on
              your machine, no browser required.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DownloadDesktop />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="get-started" className="lp-cta roko-ember-grid">
        <div className="lp-container lp-cta-grid">
          <h2>
            Set up your vault in <em>90 seconds</em>.
          </h2>
          <div>
            <p>Free for individuals. No account required. Works offline.</p>
            <div className="lp-cta-actions">
              <Link href="/vault" className="lp-btn lp-btn-dark">
                Open vault <ArrowRight />
              </Link>
              <a href="#download" className="lp-btn lp-btn-outline-ink">
                Get the desktop app
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-brand">
              <RokoLogo size={34} tone="onDark" />
              <p>
                Encrypted password manager for individuals and teams. Your master password never leaves
                your device.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                {NAV_LINKS.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 RokoPW. Zero-trust. Open source.</span>
            <span>AES-256-GCM · PBKDF2-SHA256 · Web Crypto API</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
