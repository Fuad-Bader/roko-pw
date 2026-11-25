'use client'

import { useState, type FormEvent } from 'react'
import { useVault } from './VaultProvider'
import { useTheme } from './ThemeProvider'
import { RokoLogo } from './RokoLogo'
import { RecoverVault } from './RecoverVault'
import { OrgAccess } from './OrgAccess'
import { Button } from '@/components/base/buttons/button'
import { ArrowRight, Moon01, Sun, Folder, HardDrive, Building07 } from '@untitledui/icons'

type LocalMode = 'unlock' | 'create' | 'recover'

const inputCls =
  'w-full rounded-[10px] border border-border-primary bg-primary px-3.5 py-2.5 text-sm text-primary shadow-xs outline-none transition placeholder:text-placeholder focus:border-border-brand focus:ring-1 focus:ring-brand'
const labelCls = 'mb-1.5 block text-[13px] font-medium text-secondary'

export function UnlockScreen({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { mode, switchMode, org } = useVault()
  const { theme, toggleTheme } = useTheme()
  const isOrg = mode === 'org'

  return (
    <div className="grid min-h-screen grid-cols-1 bg-primary lg:grid-cols-[420px_1fr]">
      {/* ── Left: Roko blueprint panel ── */}
      <aside
        className="roko-blueprint hidden min-h-screen flex-col justify-between gap-10 px-11 py-10 lg:flex"
        style={{ borderRight: '1px solid rgb(255 255 255 / 0.07)' }}
      >
        <RokoLogo size={30} tone="onDark" />
        <div>
          <p className="roko-eyebrow mb-4">{isOrg ? 'Zero-knowledge for teams' : 'Zero-knowledge vault'}</p>
          <h2 className="mb-3.5 text-4xl font-bold leading-[1.08] text-[var(--paper)]">
            {isOrg ? (
              <>
                Your org&apos;s <em>vaults</em>.
              </>
            ) : (
              <>
                Your <em>vault</em>, on this device.
              </>
            )}
          </h2>
          <p className="mb-8 text-[15px] leading-relaxed text-[var(--ink-300)]">
            {isOrg
              ? 'Admins decide who can open, edit and download each vault. Keys are shared per person, so the server never sees a password or a secret.'
              : 'Encrypted with your master password. Nothing leaves this device unless you export it.'}
          </p>
          <div className="roko-terminal" aria-hidden="true">
            <div className="roko-terminal-bar">
              <i />
              <i />
              <i />
              <span>roko — {isOrg ? 'org' : 'vault'}</span>
            </div>
            <div className="roko-terminal-body">
              <div>
                <span className="roko-t-prompt">$ </span>
                <span className="roko-t-cmd">{isOrg ? 'roko org sign-in' : 'roko unlock --local'}</span>
              </div>
              {(isOrg
                ? ['Per-user RSA-3072 keys', 'AES-256-GCM vault keys', 'Admin-managed permissions', 'Every download audited']
                : ['AES-256-GCM encryption', 'Key derived on this device', 'SSH, RDP and VPN items', 'Recovery phrase backup']
              ).map((line) => (
                <div key={line}>
                  <span className="roko-t-ok">✓</span> {line}
                </div>
              ))}
              <div className="h-[0.6em]" />
              <div>
                <span className="roko-t-dim">server sees </span>
                <span className="roko-t-hi">0 passwords</span>
              </div>
              <div>
                <span className="roko-t-prompt">$ </span>
                <span className="roko-cursor" />
              </div>
            </div>
          </div>
        </div>
        <div className="font-mono text-xs text-[var(--ink-500)]">All encryption happens locally · Open source</div>
      </aside>

      {/* ── Right ── */}
      <main className="relative flex flex-col items-center justify-center px-6 py-16 sm:px-12">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="absolute right-6 top-6 grid size-9 place-items-center rounded-full border border-border-primary bg-primary text-secondary transition hover:text-primary"
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon01 className="size-3.5" />}
        </button>

        <div className="w-full max-w-[400px]">
          <div className="mb-6 lg:hidden">
            <RokoLogo size={28} />
          </div>

          {/* Personal vault vs organization */}
          {!(isOrg && org.phase === 'choosing') && (
            <div className="mb-8 grid grid-cols-2 gap-1 rounded-full border border-border-primary bg-secondary p-1" role="tablist">
              {(
                [
                  { id: 'local', label: 'Personal vault', icon: HardDrive },
                  { id: 'org', label: 'Organization', icon: Building07 },
                ] as const
              ).map((t) => {
                const active = mode === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => !active && switchMode(t.id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition ${
                      active ? 'bg-primary text-primary shadow-xs' : 'text-tertiary hover:text-secondary'
                    }`}
                  >
                    <t.icon className="size-4" /> {t.label}
                  </button>
                )
              })}
            </div>
          )}

          {isOrg ? <OrgAccess onOpenAdmin={onOpenAdmin} /> : <LocalAccess />}
        </div>
      </main>
    </div>
  )
}

function LocalAccess() {
  const { status, unlock, createVault, importFromFile, error, clearError } = useVault()
  const [mode, setMode] = useState<LocalMode>(status === 'empty' ? 'create' : 'unlock')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const switchTo = (next: LocalMode) => {
    setMode(next)
    setPassword('')
    setConfirm('')
    setLocalError('')
    clearError()
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalError('')
    clearError()
    if (mode === 'create') {
      if (password.length < 8) return setLocalError('Master password must be at least 8 characters.')
      if (password !== confirm) return setLocalError('Passwords do not match.')
    }
    setLoading(true)
    try {
      if (mode === 'create') await createVault(password)
      else await unlock(password)
    } finally {
      setLoading(false)
      setPassword('')
      setConfirm('')
    }
  }

  const handleImport = async () => {
    setImportLoading(true)
    try {
      if (await importFromFile()) switchTo('unlock')
    } finally {
      setImportLoading(false)
    }
  }

  if (mode === 'recover') return <RecoverVault onCancel={() => switchTo('unlock')} />

  const shownError = localError || error

  return (
    <>
      <div className="mb-7">
        <p className="roko-eyebrow mb-3.5">{mode === 'create' ? 'New vault' : 'Personal vault'}</p>
        <h1 className="mb-1.5 text-[30px] font-bold leading-tight">{mode === 'create' ? 'Create vault' : 'Welcome back'}</h1>
        <p className="text-sm text-tertiary">
          {mode === 'create' ? 'Set your master password to get started.' : 'Enter your master password to unlock.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelCls} htmlFor="password">Master password</label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter master password"
            required
            className={inputCls}
          />
        </div>
        {mode === 'create' && (
          <div>
            <label className={labelCls} htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              className={inputCls}
            />
          </div>
        )}
        {shownError && <p className="rounded-[10px] bg-error-primary px-3.5 py-2.5 text-[13px] text-error-primary">{shownError}</p>}
        <Button type="submit" size="lg" isDisabled={loading} isLoading={loading} iconTrailing={ArrowRight}>
          {mode === 'create' ? 'Create vault' : 'Unlock vault'}
        </Button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button type="button" onClick={() => switchTo(mode === 'unlock' ? 'create' : 'unlock')} className="text-[13px] text-tertiary underline underline-offset-4">
          {mode === 'unlock' ? 'Create a new vault instead' : 'I already have a vault'}
        </button>
        {mode === 'unlock' && (
          <button type="button" onClick={() => switchTo('recover')} className="text-[13px] text-tertiary underline underline-offset-4">
            Forgot password? Use recovery phrase
          </button>
        )}
      </div>

      <div className="mt-6">
        <Button type="button" onClick={handleImport} isDisabled={importLoading} isLoading={importLoading} color="secondary" size="sm" className="w-full" iconLeading={Folder}>
          Open vault from file
        </Button>
      </div>

      <p className="mt-5 text-center font-mono text-[11px] text-tertiary">All encryption happens locally · Nothing leaves this device</p>
    </>
  )
}
