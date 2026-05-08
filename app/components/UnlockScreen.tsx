'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import { useTheme, ACCENTS } from './ThemeProvider'
import { RecoverVault } from './RecoverVault'
import { ServerLogin } from './ServerLogin'
import type { VaultMeta } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'
import {
  Lock01,
  CheckCircle,
  ArrowRight,
  Moon01,
  Sun,
  ShieldTick,
  Fingerprint01,
  Cloud01,
} from '@untitledui/icons'

type Mode = 'unlock' | 'create' | 'recover' | 'server'

function Logo({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: light ? 'rgba(255,255,255,.15)' : 'var(--color-bg-brand-solid)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock01 size={size * 0.6} color="#fff" />
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: size * 0.64,
          letterSpacing: '-0.02em',
          color: light ? '#fff' : 'var(--color-text-primary)',
        }}
      >
        Roko<span style={{ color: light ? 'rgba(255,255,255,.7)' : 'var(--color-bg-brand-solid)' }}>PW</span>
      </span>
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 8,
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: 14,
  outline: 'none',
  boxShadow: '0 1px 2px 0 rgba(16,24,40,.05)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.12s, box-shadow 0.12s',
}

export function UnlockScreen() {
  const {
    status,
    unlock,
    createVault,
    importFromFile,
    error,
    clearError,
    settings,
    applySettings,
    serverSession,
    logoutServer,
  } = useVault()
  const { theme, toggleTheme, accent, setAccent } = useTheme()
  const [mode, setMode] = useState<Mode>(status === 'empty' ? 'create' : 'unlock')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError('')
    clearError()

    if (mode === 'create') {
      if (password.length < 8) {
        setLocalError('Master password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'create') {
        await createVault(password)
      } else {
        await unlock(password)
      }
    } finally {
      setLoading(false)
      setPassword('')
      setConfirm('')
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setPassword('')
    setConfirm('')
    setLocalError('')
    clearError()
  }

  const handleImport = async () => {
    setImportLoading(true)
    try {
      await importFromFile()
      switchMode('unlock')
    } finally {
      setImportLoading(false)
    }
  }

  const handleVaultSelected = async (vault: VaultMeta) => {
    await applySettings({ backend: 'remote', vaultId: vault.id, serverUrl: settings.serverUrl })
    switchMode(vault.id ? 'unlock' : 'create')
  }

  const displayError = localError || error

  if (mode === 'recover') {
    return (
      <UnlockShell theme={theme} toggleTheme={toggleTheme} accent={accent} setAccent={setAccent}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 24 }}>
            <Logo size={28} />
          </div>
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 24px 48px -12px rgba(16,24,40,.18)',
            }}
          >
            <RecoverVault onCancel={() => switchMode('unlock')} />
          </div>
        </div>
      </UnlockShell>
    )
  }

  if (mode === 'server') {
    return (
      <UnlockShell theme={theme} toggleTheme={toggleTheme} accent={accent} setAccent={setAccent}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 24 }}>
            <Logo size={28} />
          </div>
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 24px 48px -12px rgba(16,24,40,.18)',
            }}
          >
            <ServerLogin
              onVaultSelected={handleVaultSelected}
              onCancel={() => switchMode(status === 'empty' ? 'create' : 'unlock')}
            />
          </div>
        </div>
      </UnlockShell>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
      }}
    >
      {/* ── Left: Dark sidebar ── */}
      <aside
        style={{
          background: 'var(--color-bg-primary-solid)',
          padding: '40px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh',
        }}
      >
        <Logo size={26} light />

        <div>
          <h2
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: 32,
              lineHeight: '40px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#fff',
              margin: '0 0 12px',
            }}
          >
            {mode === 'create' ? 'Create your vault' : 'Unlock your vault'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 15, lineHeight: '22px', margin: '0 0 40px' }}>
            {mode === 'create'
              ? 'Choose a strong master password. Your encryption key is derived locally — nothing is sent to the server.'
              : 'Enter your master password to decrypt and access your credentials.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              {
                icon: ShieldTick,
                t: 'Zero-knowledge encryption',
                d: 'AES-256-GCM with PBKDF2. Your master password never leaves your device.',
              },
              {
                icon: Fingerprint01,
                t: 'Passkeys & autofill',
                d: 'Fill passwords instantly with the browser extension.',
              },
              {
                icon: Cloud01,
                t: 'Sync across devices',
                d: 'Encrypted sync via your own server. Fully optional.',
              },
            ].map((f) => {
              const Icon = f.icon
              return (
                <div key={f.t} style={{ display: 'flex', gap: 12 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,.08)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <Icon size={18} color="var(--color-brand-300)" />
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: '18px' }}>{f.d}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
          All encryption happens locally · Open source
        </div>
      </aside>

      {/* ── Right: Form ── */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          position: 'relative',
        }}
      >
        {/* Theme controls top-right */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                style={{
                  width: 16,
                  height: 16,
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
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon01 size={14} />}
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Server session banner */}
          {serverSession && settings.backend === 'remote' && (
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                border: '1px solid var(--color-brand-200)',
                borderRadius: 8,
                background: 'var(--color-brand-50)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Cloud01 size={14} color="var(--color-brand-600)" />
                <span style={{ fontSize: 12, color: 'var(--color-brand-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {serverSession.serverUrl}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 8, flexShrink: 0 }}>
                <button onClick={() => switchMode('server')} style={{ fontSize: 12, color: 'var(--color-brand-700)', background: 'none', border: 0, cursor: 'pointer' }}>
                  Switch
                </button>
                <button onClick={logoutServer} style={{ fontSize: 12, color: 'var(--color-text-tertiary)', background: 'none', border: 0, cursor: 'pointer' }}>
                  Sign out
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
              {mode === 'create' ? 'Create vault' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-tertiary)', margin: 0 }}>
              {mode === 'create'
                ? 'Set your master password to get started.'
                : 'Enter your master password to unlock.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}
                htmlFor="password"
              >
                {settings.backend === 'remote' ? 'Vault password' : 'Master password'}
              </label>
              <input
                id="password"
                type="password"
                autoFocus
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Enter ${settings.backend === 'remote' ? 'vault' : 'master'} password`}
                required
                style={inputStyle}
              />
            </div>

            {mode === 'create' && (
              <div>
                <label
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}
                  htmlFor="confirm"
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  style={inputStyle}
                />
              </div>
            )}

            {displayError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--color-bg-error-primary)',
                  color: 'var(--color-fg-error-primary)',
                  fontSize: 13,
                }}
              >
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 44,
                borderRadius: 8,
                background: loading ? 'var(--color-brand-400)' : 'var(--color-bg-brand-solid)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                border: 0,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px 0 rgba(16,24,40,.05), inset 0 -2px 0 rgba(16,24,40,.05), inset 0 0 0 1px rgba(16,24,40,.18)',
                transition: 'background 0.12s',
              }}
            >
              {loading ? 'Loading…' : mode === 'create' ? 'Create vault' : 'Unlock vault'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Secondary actions */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => switchMode(mode === 'unlock' ? 'create' : 'unlock')}
              style={{ fontSize: 13, color: 'var(--color-text-tertiary)', background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              {mode === 'unlock' ? 'Create a new vault instead' : 'I already have a vault'}
            </button>
            {mode === 'unlock' && (
              <button
                type="button"
                onClick={() => switchMode('recover')}
                style={{ fontSize: 13, color: 'var(--color-text-tertiary)', background: 'none', border: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Forgot password? Use recovery phrase
              </button>
            )}
          </div>

          {/* File / server actions */}
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button
              type="button"
              onClick={handleImport}
              isDisabled={importLoading}
              isLoading={importLoading}
              color="secondary"
              size="sm"
              className="w-full"
            >
              📂 Open from file
            </Button>
            <Button
              type="button"
              onClick={() => switchMode('server')}
              color="secondary"
              size="sm"
              className="w-full"
            >
              ☁️ {serverSession ? 'Switch server' : 'Connect server'}
            </Button>
          </div>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            All encryption happens locally · The server never sees your passwords
          </p>
        </div>
      </main>
    </div>
  )
}

// ─── Simple shell for recover/server sub-modes ─────────────────────────────────

function UnlockShell({
  children,
  theme,
  toggleTheme,
  accent,
  setAccent,
}: {
  children: React.ReactNode
  theme: string
  toggleTheme: () => void
  accent: string
  setAccent: (a: any) => void
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-secondary)',
        padding: 24,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAccent(a.id)}
            title={a.label}
            style={{ width: 14, height: 14, borderRadius: '50%', background: a.color, border: accent === a.id ? '2px solid var(--color-text-primary)' : '2px solid transparent', cursor: 'pointer', padding: 0, outline: 'none', boxSizing: 'border-box' }}
          />
        ))}
        <button
          onClick={toggleTheme}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon01 size={12} />}
        </button>
      </div>
      {children}
    </div>
  )
}
