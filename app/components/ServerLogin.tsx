'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import type { VaultMeta } from '@/lib/types'
import { Button } from '@/components/base/buttons/button'

type Step = 'url' | 'email' | 'otp' | 'vaults'

interface Props {
  onVaultSelected: (vault: VaultMeta) => void
  onCancel: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

export function ServerLogin({ onVaultSelected, onCancel }: Props) {
  const {
    probeServer,
    requestOtp,
    verifyOtp,
    serverVaults,
    serverSession,
    serverLoading,
    createServerVault,
    refreshServerVaults,
    error,
    clearError,
  } = useVault()

  const [step, setStep] = useState<Step>(serverSession ? 'vaults' : 'url')
  const [serverUrl, setServerUrl] = useState(serverSession?.serverUrl ?? '')
  const [serverName, setServerName] = useState('')
  const [email, setEmail] = useState(serverSession?.email ?? '')
  const [otp, setOtp] = useState('')
  const [localError, setLocalError] = useState('')
  const [probing, setProbing] = useState(false)
  const [newVaultName, setNewVaultName] = useState('')
  const [creatingVault, setCreatingVault] = useState(false)
  const [showNewVault, setShowNewVault] = useState(false)

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

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      await requestOtp(serverUrl, email)
      setStep('otp')
    } catch { /* error shown via context */ }
  }

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      await verifyOtp(serverUrl, email, otp.trim())
      setStep('vaults')
    } catch { /* error shown via context */ }
  }

  const handleCreateVault = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    const name = newVaultName.trim() || 'My Vault'
    setCreatingVault(true)
    try {
      const vault = await createServerVault(name)
      onVaultSelected(vault)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create vault')
    } finally {
      setCreatingVault(false)
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
          We&apos;ll send a one-time login code to your inbox.
        </p>
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <input
            type="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
          />
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
              Send code
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
        <h3 className="mb-1 text-sm font-semibold text-primary">Enter your login code</h3>
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
              Verify
            </Button>
          </div>
          <button
            type="button"
            onClick={() => { clearErrors(); requestOtp(serverUrl, email).catch(() => {}) }}
            className="w-full text-xs text-quaternary transition hover:text-tertiary"
          >
            Resend code
          </button>
        </form>
      </div>
    )
  }

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

      <div className="mb-3 space-y-1.5">
        {serverVaults.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onVaultSelected(v)}
            className="flex w-full items-center justify-between rounded-lg border border-border-primary bg-tertiary px-3 py-2.5 text-left transition hover:border-border-brand hover:bg-secondary_hover"
          >
            <div>
              <p className="text-sm font-medium text-primary">{v.name}</p>
              <p className="text-xs text-quaternary">
                {v.role === 'owner' ? 'Owner' : 'Member'} ·{' '}
                {v.member_count} member{v.member_count !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="text-tertiary">›</span>
          </button>
        ))}
      </div>

      {showNewVault ? (
        <form onSubmit={handleCreateVault} className="space-y-2">
          <input
            type="text"
            autoFocus
            placeholder="Vault name"
            value={newVaultName}
            onChange={(e) => setNewVaultName(e.target.value)}
            className={inputCls}
          />
          {displayError && (
            <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { setShowNewVault(false); clearErrors() }}
              color="secondary"
              size="sm"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={creatingVault}
              isLoading={creatingVault}
              color="primary"
              size="sm"
              className="flex-1"
            >
              Create
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewVault(true)}
          className="w-full rounded-lg border border-dashed border-border-primary px-3 py-2 text-sm text-quaternary transition hover:border-border-brand hover:text-tertiary"
        >
          + New vault
        </button>
      )}

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
