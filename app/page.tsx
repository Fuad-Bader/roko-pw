'use client'

import Link from 'next/link'
import { InstallButton } from './components/InstallButton'
import { useTheme, ACCENTS } from './components/ThemeProvider'
import {
  ShieldTick,
  Fingerprint01,
  Lightning01,
  Users01,
  RefreshCw01,
  Cloud01,
  CheckCircle,
  ArrowRight,
  Moon01,
  Sun,
  Lock01,
} from '@untitledui/icons'

function Logo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: 'var(--color-bg-brand-solid)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock01 size={size * 0.6} color="#fff" />
      </span>
      <span
        style={{
          fontFamily: 'var(--font-inter)',
          fontWeight: 700,
          fontSize: size * 0.64,
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary)',
        }}
      >
        Roko<span style={{ color: 'var(--color-bg-brand-solid)' }}>PW</span>
      </span>
    </span>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: '20px',
        background: 'var(--color-brand-50)',
        color: 'var(--color-brand-700)',
        border: '1px solid var(--color-brand-200)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-brand-600)',
        }}
      />
      {children}
    </span>
  )
}

function FeatIcon({ icon: Icon, size = 48 }: { icon: React.ElementType; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 12,
        background: 'var(--color-brand-100)',
        color: 'var(--color-brand-600)',
        boxShadow: '0 0 0 6px var(--color-brand-50)',
      }}
    >
      <Icon size={size * 0.5} />
    </span>
  )
}

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

export default function LandingPage() {
  const { theme, toggleTheme, accent, setAccent } = useTheme()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-inter)',
      }}
    >
      {/* ── Navigation ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid var(--color-border-secondary)',
          background: 'color-mix(in srgb, var(--color-bg-primary) 85%, transparent)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '0 32px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 32,
          }}
        >
          <Logo size={28} />

          <nav style={{ display: 'flex', gap: 32, flex: 1, justifyContent: 'center' }}>
            {['Features', 'Security', 'Pricing', 'Download'].map((l) => (
              <a
                key={l}
                href="#"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'color 0.12s',
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = 'var(--color-text-primary)')
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = 'var(--color-text-secondary)')
                }
              >
                {l}
              </a>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Accent picker */}
            <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  title={a.label}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: a.color,
                    border: accent === a.id ? `2px solid var(--color-text-primary)` : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon01 size={16} />}
            </button>

            <Link
              href="/vault"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px 0 rgba(16,24,40,.05)',
                transition: 'background 0.12s',
              }}
            >
              Sign in
            </Link>

            <Link
              href="/vault"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                background: 'var(--color-bg-brand-solid)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow:
                  '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
                transition: 'background 0.12s',
              }}
            >
              Get started free <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        style={{
          padding: '96px 32px 80px',
          textAlign: 'center',
          maxWidth: 1280,
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Badge>AES-256-GCM · PBKDF2 · Zero-knowledge</Badge>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-inter)',
            fontWeight: 700,
            fontSize: 'clamp(48px, 6vw, 72px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            margin: '0 auto 24px',
            maxWidth: 900,
          }}
        >
          Every password.{' '}
          <span style={{ color: 'var(--color-bg-brand-solid)' }}>One secure home.</span>
        </h1>

        <p
          style={{
            fontSize: 20,
            lineHeight: '30px',
            color: 'var(--color-text-tertiary)',
            maxWidth: 640,
            margin: '0 auto 40px',
          }}
        >
          RokoPW encrypts your logins, cards and notes end-to-end on your device — then syncs them
          everywhere you sign in. Free for individuals, forever.
        </p>

        <div
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}
        >
          <InstallButton size="lg" />
          <Link
            href="/vault"
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
              boxShadow:
                '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
            }}
          >
            Open vault <ArrowRight size={18} />
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            flexWrap: 'wrap',
            color: 'var(--color-text-tertiary)',
            fontSize: 14,
          }}
        >
          {['No credit card', 'Free for individuals', 'Works offline'].map((t) => (
            <span
              key={t}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={16} color="var(--color-bg-brand-solid)" />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Product preview ── */}
      <section style={{ padding: '0 32px 96px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            height: 520,
            background: `linear-gradient(135deg, var(--color-brand-50), var(--color-bg-secondary))`,
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 24px 48px -12px rgba(16,24,40,.18)',
            border: '1px solid var(--color-border-secondary)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 24,
              background: 'var(--color-bg-primary)',
              borderRadius: 12,
              display: 'grid',
              gridTemplateColumns: '220px 1fr',
              overflow: 'hidden',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            {/* Sidebar */}
            <aside
              style={{
                background: 'var(--color-bg-secondary)',
                borderRight: '1px solid var(--color-border-secondary)',
                padding: '16px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ padding: '0 6px 8px' }}>
                <Logo size={20} />
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
                    padding: '7px 10px',
                    borderRadius: 6,
                    background: r.active ? 'var(--color-bg-primary)' : 'transparent',
                    boxShadow: r.active ? '0 1px 2px 0 rgba(16,24,40,.05)' : 'none',
                    color: r.active ? 'var(--color-brand-700)' : 'var(--color-text-secondary)',
                    fontSize: 13,
                    fontWeight: r.active ? 600 : 500,
                  }}
                >
                  <span style={{ flex: 1 }}>{r.l}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.n}</span>
                </div>
              ))}
            </aside>

            {/* Main */}
            <main style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>All items</h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    background: 'var(--color-bg-brand-solid)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  + New
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { name: 'GitHub', user: 'alice@hey.com', c: '#0d1117', letters: 'GH' },
                  { name: 'Stripe', user: 'team@aurora.co', c: '#635BFF', letters: 'S' },
                  { name: 'Figma', user: 'alice@hey.com', c: '#F24E1E', letters: 'F' },
                  { name: 'Linear', user: 'alice@aurora.co', c: '#5E6AD2', letters: 'L' },
                  { name: 'Notion', user: 'alice@hey.com', c: '#000', letters: 'N' },
                  { name: 'Vercel', user: 'alice@aurora.co', c: '#000', letters: 'V' },
                ].map((r) => (
                  <div
                    key={r.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: '1px solid var(--color-border-secondary)',
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
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
                          fontSize: 11,
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
            </main>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        style={{
          padding: '96px 32px',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <Badge>Features</Badge>
            <h2
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 700,
                fontSize: 36,
                lineHeight: '44px',
                letterSpacing: '-0.02em',
                margin: '16px 0',
              }}
            >
              Built around how you actually work.
            </h2>
            <p
              style={{
                fontSize: 18,
                color: 'var(--color-text-tertiary)',
                maxWidth: 560,
                margin: '0 auto',
                lineHeight: '28px',
              }}
            >
              Six things every password manager should do well — and we&apos;ve spent years getting
              them right.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 40,
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.title}>
                <FeatIcon icon={f.icon} size={48} />
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    marginTop: 24,
                    marginBottom: 8,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 16,
                    color: 'var(--color-text-tertiary)',
                    lineHeight: '24px',
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section style={{ padding: '96px 32px' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: 64,
            alignItems: 'center',
          }}
        >
          <div>
            <Badge>Security</Badge>
            <h2
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 700,
                fontSize: 36,
                lineHeight: '44px',
                letterSpacing: '-0.02em',
                margin: '16px 0',
              }}
            >
              Encrypted before it leaves your device.
            </h2>
            <p
              style={{
                fontSize: 18,
                color: 'var(--color-text-tertiary)',
                marginBottom: 32,
                lineHeight: '28px',
              }}
            >
              Your master password is the only key to your vault — and we never see it. We use the
              browser&apos;s built-in Web Crypto API; no third-party crypto libraries.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                {
                  t: 'AES-256-GCM with PBKDF2',
                  d: 'Industry-leading encryption. Open-sourced and reproducible.',
                },
                {
                  t: 'Browser Web Crypto API',
                  d: 'No third-party libraries. Trust the platform, trust the math.',
                },
                {
                  t: 'Offline-first design',
                  d: 'Works entirely offline. Server access is optional, never required.',
                },
              ].map((r) => (
                <div key={r.t} style={{ display: 'flex', gap: 12 }}>
                  <CheckCircle
                    size={20}
                    color="var(--color-bg-brand-solid)"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{r.t}</div>
                    <div style={{ fontSize: 14, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {r.d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code block */}
          <div
            style={{
              background: 'var(--color-bg-primary-solid)',
              borderRadius: 20,
              padding: 32,
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 240,
                height: 240,
                background: `radial-gradient(circle, color-mix(in srgb, var(--color-brand-500) 40%, transparent), transparent 70%)`,
              }}
            />
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--color-brand-100)',
                  color: 'var(--color-brand-600)',
                  marginBottom: 20,
                }}
              >
                <ShieldTick size={24} />
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 12,
                  lineHeight: '20px',
                  color: 'var(--color-brand-200)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >{`function encrypt(vault, masterPassword) {
  const salt   = crypto.getRandomValues(new Uint8Array(16));
  const key    = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600_000,
      hash: "SHA-256" },
    await importKey(masterPassword),
    { name: "AES-GCM", length: 256 },
    false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, vault
  );
  return { salt, iv, cipher };
  // → server only ever sees ciphertext.
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          padding: '96px 32px',
          background: `linear-gradient(135deg, var(--color-brand-700), var(--color-brand-900))`,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2
              style={{
                fontFamily: 'var(--font-inter)',
                fontWeight: 700,
                fontSize: 36,
                lineHeight: '44px',
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: '0 0 16px',
              }}
            >
              How RokoPW protects you.
            </h2>
            <p style={{ fontSize: 18, color: 'var(--color-brand-200)', maxWidth: 560, margin: '0 auto' }}>
              Four layers between an attacker and your data. Each independently verifiable.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {STEPS.map((s) => (
              <div
                key={s.n}
                style={{
                  paddingTop: 24,
                  borderTop: '1px solid rgba(255,255,255,.2)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    color: 'var(--color-brand-300)',
                    marginBottom: 16,
                    fontWeight: 500,
                  }}
                >
                  {s.n}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }}>
                  {s.title}
                </h3>
                <p style={{ color: 'var(--color-brand-200)', fontSize: 14, lineHeight: '22px', margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '96px 32px' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            textAlign: 'center',
            padding: '80px 48px',
            background: 'var(--color-bg-secondary)',
            borderRadius: 24,
            border: '1px solid var(--color-border-secondary)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-inter)',
              fontWeight: 700,
              fontSize: 'clamp(32px, 4vw, 48px)',
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              margin: '0 0 16px',
            }}
          >
            Set up your vault in 90 seconds.
          </h2>
          <p
            style={{
              fontSize: 18,
              color: 'var(--color-text-tertiary)',
              marginBottom: 40,
              maxWidth: 480,
              margin: '0 auto 40px',
            }}
          >
            Free for individuals. No account required. Works offline.
          </p>
          <div
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <InstallButton size="lg" />
            <Link
              href="/vault"
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
                boxShadow:
                  '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
              }}
            >
              Open vault <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border-secondary)',
          padding: '48px 32px 32px',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
            gap: 32,
            marginBottom: 48,
          }}
        >
          <div>
            <Logo size={24} />
            <p
              style={{
                marginTop: 16,
                fontSize: 14,
                color: 'var(--color-text-tertiary)',
                maxWidth: 280,
                lineHeight: '20px',
              }}
            >
              Encrypted password manager for individuals and teams. Your master password never
              leaves your device.
            </p>
          </div>
          {[
            { h: 'Product', l: ['Features', 'Security', 'Pricing', 'Download', 'Changelog'] },
            { h: 'Resources', l: ['Documentation', 'API', 'Status', 'Support'] },
            { h: 'Legal', l: ['Privacy', 'Terms', 'Cookies'] },
          ].map((g) => (
            <div key={g.h}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 16,
                }}
              >
                {g.h}
              </div>
              {g.l.map((l) => (
                <div
                  key={l}
                  style={{
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 12,
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 32,
            borderTop: '1px solid var(--color-border-secondary)',
            color: 'var(--color-text-tertiary)',
            fontSize: 14,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span>© 2026 RokoPW. Zero-trust. Open source.</span>
          <span>Encrypted with AES-256-GCM · PBKDF2-SHA256 · Web Crypto API</span>
        </div>
      </footer>
    </div>
  )
}
