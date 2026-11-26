'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@roko/ui/components/base/buttons/button'
import { ArrowRight, Building07, Clock, Lock01, LogOut01, RefreshCw01, Settings01, Eye, Edit03, Download01 } from '@untitledui/icons'
import { useVault, lastOrgServer } from './VaultProvider'
import type { OrgVaultMeta } from '@roko/vault-core/lib/orgApi'

const inputCls =
  'w-full rounded-[10px] border border-border-primary bg-primary px-3.5 py-2.5 text-sm text-primary shadow-xs outline-none transition placeholder:text-placeholder focus:border-border-brand focus:ring-1 focus:ring-brand'
const labelCls = 'mb-1.5 block text-[13px] font-medium text-secondary'

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[10px] bg-error-primary px-3.5 py-2.5 text-[13px] text-error-primary">{children}</p>
}

function Heading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mb-7">
      <p className="roko-eyebrow mb-3.5">{eyebrow}</p>
      <h1 className="mb-1.5 text-[30px] font-bold leading-tight">{title}</h1>
      <p className="text-sm text-tertiary">{sub}</p>
    </div>
  )
}

/** Everything an org user sees before a vault is open. */
export function OrgAccess({ onOpenAdmin, defaultServerUrl }: { onOpenAdmin?: () => void; defaultServerUrl?: string }) {
  const { org } = useVault()
  if (org.phase === 'locked') return <OrgUnlock />
  if (org.phase === 'choosing') return <OrgVaultPicker onOpenAdmin={onOpenAdmin} />
  return <OrgSignIn defaultServerUrl={defaultServerUrl} />
}

/**
 * Sign in to an org server. `fixedServerUrl` hides the server field (the admin
 * console is served by the server it manages); `defaultServerUrl` only prefills it.
 */
export function OrgSignIn({ fixedServerUrl, defaultServerUrl, eyebrow = 'Organization', title = 'Sign in to your org' }: { fixedServerUrl?: string; defaultServerUrl?: string; eyebrow?: string; title?: string }) {
  const { orgSignIn, orgVerify, error } = useVault()
  const last = typeof window !== 'undefined' ? lastOrgServer() : null
  const [serverUrl, setServerUrl] = useState(fixedServerUrl ?? last?.serverUrl ?? defaultServerUrl ?? '')
  const [email, setEmail] = useState(last?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [newAccount, setNewAccount] = useState(false)
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (!/^https?:\/\//.test(serverUrl.trim())) return setLocalError('Enter the full server address, e.g. https://vault.acme.com')
    if (password.length < 8) return setLocalError('Your password must be at least 8 characters.')
    setBusy(true)
    try {
      const res = await orgSignIn(serverUrl, email, password)
      setNewAccount(res.newAccount)
      setStep('code')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError('')
    if (newAccount && password !== confirm) return setLocalError('Passwords do not match.')
    setBusy(true)
    try {
      await orgVerify(otp)
      setPassword('')
      setConfirm('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'That code did not work.')
    } finally {
      setBusy(false)
    }
  }

  const shownError = localError || error

  if (step === 'code') {
    return (
      <>
        <Heading
          eyebrow="Check your email"
          title="Enter your code"
          sub={`We sent a 6-digit code to ${email.trim().toLowerCase()}.`}
        />
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <div>
            <label className={labelCls} htmlFor="org-otp">Sign-in code</label>
            <input
              id="org-otp"
              className={`${inputCls} font-mono text-lg tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </div>
          {newAccount && (
            <div>
              <label className={labelCls} htmlFor="org-confirm">Confirm your new password</label>
              <input id="org-confirm" type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              <p className="mt-1.5 text-xs text-tertiary">
                Your password protects your encryption keys. It never leaves this device, so nobody, including your admin, can reset it for you.
              </p>
            </div>
          )}
          {shownError && <ErrorNote>{shownError}</ErrorNote>}
          <Button type="submit" size="lg" isDisabled={busy || otp.length !== 6} isLoading={busy} iconTrailing={ArrowRight}>
            {newAccount ? 'Create account' : 'Sign in'}
          </Button>
          <button type="button" className="text-[13px] text-tertiary underline underline-offset-4" onClick={() => setStep('credentials')}>
            Use a different account
          </button>
        </form>
      </>
    )
  }

  return (
    <>
      <Heading
        eyebrow={eyebrow}
        title={title}
        sub={fixedServerUrl ? `Server: ${fixedServerUrl.replace(/^https?:\/\//, '')}` : 'Use the server address your admin gave you.'}
      />
      <form onSubmit={submitCredentials} className="flex flex-col gap-4">
        {!fixedServerUrl && (
          <div>
            <label className={labelCls} htmlFor="org-server">Server</label>
            <input id="org-server" className={`${inputCls} font-mono`} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://vault.acme.com" autoComplete="url" spellCheck={false} />
          </div>
        )}
        <div>
          <label className={labelCls} htmlFor="org-email">Work email</label>
          <input id="org-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@acme.com" autoComplete="username" />
        </div>
        <div>
          <label className={labelCls} htmlFor="org-password">Password</label>
          <input id="org-password" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your account password" />
          <p className="mt-1.5 text-xs text-tertiary">First time? Choose a password here; you will confirm it after the email code.</p>
        </div>
        {shownError && <ErrorNote>{shownError}</ErrorNote>}
        <Button type="submit" size="lg" isDisabled={busy} isLoading={busy} iconTrailing={ArrowRight}>
          Continue
        </Button>
      </form>
    </>
  )
}

export function OrgUnlock() {
  const { org, orgUnlock, orgSignOut, error } = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setBusy(true)
    try {
      await orgUnlock(password)
      setPassword('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not unlock.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading eyebrow="Organization" title="Welcome back" sub={`Unlock ${org.session?.email ?? 'your account'} on ${org.session?.serverUrl.replace(/^https?:\/\//, '') ?? 'your server'}.`} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className={labelCls} htmlFor="org-unlock">Password</label>
          <input id="org-unlock" type="password" autoFocus className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {(localError || error) && <ErrorNote>{localError || error}</ErrorNote>}
        <Button type="submit" size="lg" isDisabled={busy || !password} isLoading={busy} iconTrailing={ArrowRight}>
          Unlock
        </Button>
        <button type="button" className="inline-flex items-center justify-center gap-1.5 text-[13px] text-tertiary underline underline-offset-4" onClick={() => void orgSignOut()}>
          <LogOut01 className="size-3.5" /> Sign out
        </button>
      </form>
    </>
  )
}

function PermissionTags({ v }: { v: OrgVaultMeta }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className="roko-tag gap-1">
        {v.canWrite ? <Edit03 className="size-3" /> : <Eye className="size-3" />}
        {v.canWrite ? 'Can edit' : 'View only'}
      </span>
      {v.canExport && (
        <span className="roko-tag gap-1">
          <Download01 className="size-3" /> Download
        </span>
      )}
    </span>
  )
}

function OrgVaultPicker({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const { org, openOrgVault, refreshOrgVaults, convertLegacyVault, orgSignOut, lock, error } = useVault()
  const [opening, setOpening] = useState<string | null>(null)
  const [localError, setLocalError] = useState('')
  const [converting, setConverting] = useState<string | null>(null)
  const [legacyPassword, setLegacyPassword] = useState('')
  const isAdmin = org.me?.role === 'admin'

  const open = async (v: OrgVaultMeta) => {
    setLocalError('')
    if (v.kind === 'legacy') {
      setConverting(v.id)
      return
    }
    setOpening(v.id)
    try {
      await openOrgVault(v.id)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not open the vault.')
    } finally {
      setOpening(null)
    }
  }

  const convert = async (e: FormEvent) => {
    e.preventDefault()
    if (!converting) return
    setOpening(converting)
    setLocalError('')
    try {
      await convertLegacyVault(converting, legacyPassword)
      setConverting(null)
      setLegacyPassword('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setOpening(null)
    }
  }

  return (
    <>
      <Heading
        eyebrow={isAdmin ? 'Org admin' : 'Organization'}
        title="Your vaults"
        sub={`Signed in as ${org.me?.email ?? ''}.`}
      />

      <div className="flex flex-col gap-2">
        {org.vaults.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-border-primary px-4 py-6 text-center text-sm text-tertiary">
            {isAdmin ? 'No vaults yet. Create one in the admin console.' : 'No vaults have been shared with you yet. Ask your org admin.'}
          </div>
        )}
        {org.vaults.map((v) => {
          const disabled = v.pending || opening !== null
          return (
            <div key={v.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => open(v)}
                className="group flex w-full items-center gap-3 rounded-[14px] border border-border-secondary bg-primary px-4 py-3 text-left transition hover:-translate-y-px hover:border-border-primary hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--ink-900)] text-[var(--ember-500)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
                  {v.pending ? <Clock className="size-5" /> : <Lock01 className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-primary">{v.name}</span>
                  <span className="mt-1 block text-xs text-tertiary">
                    {v.pending ? (
                      'Waiting for an admin to finish sharing'
                    ) : v.kind === 'legacy' ? (
                      'Legacy vault: convert it with its vault password'
                    ) : (
                      <PermissionTags v={v} />
                    )}
                  </span>
                </span>
                {opening === v.id ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
                ) : (
                  !v.pending && <ArrowRight className="size-4 text-fg-quaternary transition group-hover:text-fg-brand-primary" />
                )}
              </button>
              {converting === v.id && (
                <form onSubmit={convert} className="mt-2 flex flex-col gap-2 rounded-[14px] border border-border-secondary bg-secondary p-3">
                  <p className="text-xs text-tertiary">
                    This vault still uses a shared vault password. Enter it once to convert the vault to per-user keys; afterwards
                    access is managed in the admin console and nobody needs the password again.
                  </p>
                  <input type="password" autoFocus className={inputCls} value={legacyPassword} onChange={(e) => setLegacyPassword(e.target.value)} placeholder="Vault password" />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" color="secondary" className="flex-1" onClick={() => setConverting(null)}>Cancel</Button>
                    <Button type="submit" size="sm" className="flex-1" isDisabled={!legacyPassword || opening !== null} isLoading={opening === v.id}>Convert and open</Button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
      </div>

      {(localError || error) && <div className="mt-4"><ErrorNote>{localError || error}</ErrorNote></div>}

      <div className="mt-6 grid grid-cols-2 gap-2">
        {isAdmin && onOpenAdmin ? (
          <Button type="button" size="sm" color="secondary" iconLeading={Settings01} onClick={onOpenAdmin} className="col-span-2">
            Admin console
          </Button>
        ) : null}
        <Button type="button" size="sm" color="secondary" iconLeading={RefreshCw01} onClick={() => void refreshOrgVaults()}>
          Refresh
        </Button>
        <Button type="button" size="sm" color="secondary" iconLeading={Lock01} onClick={lock}>
          Lock
        </Button>
        <button type="button" className="col-span-2 mt-1 inline-flex items-center justify-center gap-1.5 text-[13px] text-tertiary underline underline-offset-4" onClick={() => void orgSignOut()}>
          <LogOut01 className="size-3.5" /> Sign out
        </button>
      </div>
      <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[11px] text-tertiary">
        <Building07 className="size-3.5" /> {org.session?.serverUrl.replace(/^https?:\/\//, '')}
      </p>
    </>
  )
}
