'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import type { VaultMeta } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'

type Step = 'url' | 'email' | 'otp' | 'vaults'

// When set, the vaults step shows a full create form instead of the list.
//  - 'new'  : creating a brand-new vault (name is editable)
//  - 'init' : setting the password for an existing vault that has no blob yet
type VaultForm = { mode: 'new' | 'init'; vaultId?: string; name: string }

interface Props {
  onVaultSelected: (vault: VaultMeta) => void
  onCancel: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

const MIN_PASSWORD = 8

export function ServerLogin({ onVaultSelected, onCancel }: Props) {
  const {
    probeServer,
    login,
    verifyOtp,
    serverVaults,
    serverSession,
    serverLoading,
    createServerVault,
    serverVaultHasData,
    initRemoteVault,
    refreshServerVaults,
    error,
    clearError,
  } = useVault()

  const [step, setStep] = useState<Step>(serverSession ? 'vaults' : 'url')
  const [serverUrl, setServerUrl] = useState(serverSession?.serverUrl ?? '')
  const [serverName, setServerName] = useState('')
  const [email, setEmail] = useState(serverSession?.email ?? '')
  const [password, setPassword] = useState('')
  const [newAccount, setNewAccount] = useState(false)
  const [otp, setOtp] = useState('')
  const [localError, setLocalError] = useState('')
  const [probing, setProbing] = useState(false)

  // Vault create/init form state
  const [vaultForm, setVaultForm] = useState<VaultForm | null>(null)
  const [vaultName, setVaultName] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultConfirm, setVaultConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openingVaultId, setOpeningVaultId] = useState<string | null>(null)

  const displayError = localError || error

  const clearErrors = () => {
    setLocalError('')
    clearError()
  }

  const handleProbeUrl = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) return
    setProbing(true)
    try {
      const name = await probeServer(url)
      setServerUrl(url)
      setServerName(name)
      setStep('email')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not connect to server')
    } finally {
      setProbing(false)
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      const { newAccount: isNew } = await login(serverUrl, email, password)
      setNewAccount(isNew)
      setStep('otp')
    } catch { /* error shown via context */ }
  }

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      await verifyOtp(serverUrl, email, otp.trim(), password)
      setStep('vaults')
    } catch { /* error shown via context */ }
  }

  // Open an existing vault: unlock if it has data, else prompt to set its password.
  const openVault = async (vault: VaultMeta) => {
    clearErrors()
    setOpeningVaultId(vault.id)
    try {
      const hasData = await serverVaultHasData(vault.id)
      if (hasData) {
        onVaultSelected(vault)
      } else {
        startVaultForm({ mode: 'init', vaultId: vault.id, name: vault.name })
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to open vault')
    } finally {
      setOpeningVaultId(null)
    }
  }

  const startVaultForm = (form: VaultForm) => {
    clearErrors()
    setVaultForm(form)
    setVaultName(form.name)
    setVaultPassword('')
    setVaultConfirm('')
  }

  const handleVaultSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    if (vaultPassword.length < MIN_PASSWORD) {
      setLocalError(`Vault password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (vaultPassword !== vaultConfirm) {
      setLocalError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      if (vaultForm?.mode === 'new') {
        const vault = await createServerVault(vaultName.trim() || 'My Vault')
        await initRemoteVault(vault.id, vaultPassword)
      } else if (vaultForm?.mode === 'init' && vaultForm.vaultId) {
        await initRemoteVault(vaultForm.vaultId, vaultPassword)
      }
      // On success the vault opens unlocked and this screen unmounts.
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create vault')
      setSubmitting(false)
    }
  }

  const STEPS: Step[] = ['url', 'email', 'otp', 'vaults']
  const currentStepIdx = STEPS.indexOf(step)

  const header = (
    <div className="mb-6">
      <div className="mb-1 flex items-center gap-2 text-sm text-tertiary">
        <span className="size-5 rounded bg-brand-solid/20 text-center text-xs leading-5 text-brand-400">
          🌐
        </span>
        <span className="font-medium text-secondary">
          {serverName || serverSession?.serverUrl || 'Connect to server'}
        </span>
      </div>
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-0.5 flex-1 rounded-full transition-colors ${
              currentStepIdx >= i ? 'bg-brand-solid' : 'bg-border-primary'
            }`}
          />
        ))}
      </div>
    </div>
  )

  if (step === 'url') {
    return (
      <div>
        {header}
        <h3 className="mb-4 text-sm font-semibold text-primary">Enter server URL</h3>
        <form onSubmit={handleProbeUrl} className="space-y-3">
          <input
            type="url"
            autoFocus
            placeholder="https://vault.example.com"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            required
            className={inputCls}
          />
          {displayError && (
            <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={onCancel} color="secondary" size="sm" className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={probing}
              isLoading={probing}
              color="primary"
              size="sm"
              className="flex-1"
            >
              Connect
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (step === 'email') {
    return (
      <div>
        {header}
        <h3 className="mb-1 text-sm font-semibold text-primary">Sign in with your email</h3>
        <p className="mb-4 text-xs text-quaternary">
          Enter your email and account password. We&apos;ll send a one-time code to confirm it&apos;s you.
        </p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            autoFocus
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputCls}
          />
          <p className="text-xs text-quaternary">
            New here? Just pick a password — we&apos;ll create your account after you verify your email.
          </p>
          {displayError && (
            <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { clearErrors(); setStep('url') }}
              color="secondary"
              size="sm"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              isDisabled={serverLoading}
              isLoading={serverLoading}
              color="primary"
              size="sm"
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </form>
      </div>
    )
  }

  if (step === 'otp') {
    return (
      <div>
        {header}
        <h3 className="mb-1 text-sm font-semibold text-primary">
          {newAccount ? 'Verify your email' : 'Enter your login code'}
        </h3>
        <p className="mb-4 text-xs text-quaternary">
          Check <span className="text-secondary">{email}</span> for your 6-digit code.
        </p>
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <input
            type="text"
            autoFocus
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            className={`${inputCls} text-center font-mono text-xl tracking-[.5rem] placeholder:tracking-normal`}
          />
          {displayError && (
            <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { clearErrors(); setOtp(''); setStep('email') }}
              color="secondary"
              size="sm"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              isDisabled={serverLoading || otp.length !== 6}
              isLoading={serverLoading}
              color="primary"
              size="sm"
              className="flex-1"
            >
              {newAccount ? 'Create account' : 'Verify'}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => { clearErrors(); login(serverUrl, email, password).catch(() => {}) }}
            className="w-full text-xs text-quaternary transition hover:text-tertiary"
          >
            Resend code
          </button>
        </form>
      </div>
    )
  }

  // ── Vault create / init form ─────────────────────────────────────────────────
  if (vaultForm) {
    return (
      <div>
        {header}
        <h3 className="mb-1 text-sm font-semibold text-primary">
          {vaultForm.mode === 'new' ? 'Create a vault' : `Set a password for “${vaultForm.name}”`}
        </h3>
        <p className="mb-4 text-xs text-quaternary">
          Choose a vault password. Your entries are encrypted locally with it — the server never sees it.
          We&apos;ll show you a recovery phrase to regain access if you forget it.
        </p>
        <form onSubmit={handleVaultSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Vault name</label>
            <input
              type="text"
              autoFocus={vaultForm.mode === 'new'}
              placeholder="My Vault"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              readOnly={vaultForm.mode === 'init'}
              className={`${inputCls} ${vaultForm.mode === 'init' ? 'opacity-60' : ''}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Vault password</label>
            <input
              type="password"
              autoFocus={vaultForm.mode === 'init'}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD} characters`}
              value={vaultPassword}
              onChange={(e) => setVaultPassword(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={vaultConfirm}
              onChange={(e) => setVaultConfirm(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          {displayError && (
            <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { setVaultForm(null); clearErrors() }}
              color="secondary"
              size="sm"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={submitting}
              isLoading={submitting}
              color="primary"
              size="sm"
              className="flex-1"
            >
              Create vault
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // ── Vault list ───────────────────────────────────────────────────────────────
  return (
    <div>
      {header}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Choose a vault</h3>
        <button
          type="button"
          onClick={() => { refreshServerVaults().catch(() => {}); clearErrors() }}
          className="text-xs text-quaternary transition hover:text-tertiary"
        >
          ↺ Refresh
        </button>
      </div>

      {serverVaults.length === 0 && !serverLoading && (
        <p className="mb-3 text-xs text-quaternary">No vaults yet. Create one below.</p>
      )}

      {displayError && (
        <p className="mb-3 rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
      )}

      <div className="mb-3 space-y-1.5">
        {serverVaults.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={openingVaultId === v.id}
            onClick={() => openVault(v)}
            className="flex w-full items-center justify-between rounded-lg border border-border-primary bg-tertiary px-3 py-2.5 text-left transition hover:border-border-brand hover:bg-secondary_hover disabled:opacity-60"
          >
            <div>
              <p className="text-sm font-medium text-primary">{v.name}</p>
              <p className="text-xs text-quaternary">
                {v.role === 'owner' ? 'Owner' : 'Member'} ·{' '}
                {v.member_count} member{v.member_count !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="text-tertiary">{openingVaultId === v.id ? '…' : '›'}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => startVaultForm({ mode: 'new', name: '' })}
        className="w-full rounded-lg border border-dashed border-border-primary px-3 py-2 text-sm text-quaternary transition hover:border-border-brand hover:text-tertiary"
      >
        + New vault
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full text-xs text-quaternary transition hover:text-tertiary"
      >
        Cancel
      </button>
    </div>
  )
}
