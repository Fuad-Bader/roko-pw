'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import type { VaultMeta } from '@/lib/types'

type Step = 'url' | 'email' | 'otp' | 'vaults'

interface Props {
  onVaultSelected: (vault: VaultMeta) => void
  onCancel: () => void
}

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

  // ── Step 1: Probe server URL ───────────────────────────────────────────────

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

  // ── Step 2: Request OTP ───────────────────────────────────────────────────

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      await requestOtp(serverUrl, email)
      setStep('otp')
    } catch { /* error shown via context */ }
  }

  // ── Step 3: Verify OTP ────────────────────────────────────────────────────

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    try {
      await verifyOtp(serverUrl, email, otp.trim())
      setStep('vaults')
    } catch { /* error shown via context */ }
  }

  // ── Step 4: Select vault ──────────────────────────────────────────────────

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

  // ── Shared header ─────────────────────────────────────────────────────────

  const header = (
    <div className="mb-6">
      <div className="mb-1 flex items-center gap-2 text-sm text-zinc-400">
        <span className="size-5 rounded bg-indigo-600/20 text-center text-xs leading-5 text-indigo-400">
          🌐
        </span>
        <span className="font-medium text-zinc-300">
          {serverName || serverSession?.serverUrl || 'Connect to server'}
        </span>
      </div>
      <div className="flex gap-2">
        {(['url', 'email', 'otp', 'vaults'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-0.5 flex-1 rounded-full transition-colors ${
              ['url', 'email', 'otp', 'vaults'].indexOf(step) >= i
                ? 'bg-indigo-500'
                : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>
    </div>
  )

  // ── Step 1 UI ─────────────────────────────────────────────────────────────

  if (step === 'url') {
    return (
      <div>
        {header}
        <h3 className="mb-4 text-sm font-semibold text-white">Enter server URL</h3>
        <form onSubmit={handleProbeUrl} className="space-y-3">
          <input
            type="url"
            autoFocus
            placeholder="https://vault.example.com"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {displayError && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{displayError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={probing}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {probing ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Step 2 UI ─────────────────────────────────────────────────────────────

  if (step === 'email') {
    return (
      <div>
        {header}
        <h3 className="mb-1 text-sm font-semibold text-white">Sign in with your email</h3>
        <p className="mb-4 text-xs text-zinc-500">
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {displayError && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{displayError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { clearErrors(); setStep('url') }}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={serverLoading}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {serverLoading ? 'Sending…' : 'Send code'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Step 3 UI ─────────────────────────────────────────────────────────────

  if (step === 'otp') {
    return (
      <div>
        {header}
        <h3 className="mb-1 text-sm font-semibold text-white">Enter your login code</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Check <span className="text-zinc-300">{email}</span> for your 6-digit code.
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center font-mono text-xl tracking-[.5rem] text-white placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {displayError && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{displayError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { clearErrors(); setOtp(''); setStep('email') }}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={serverLoading || otp.length !== 6}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {serverLoading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { clearErrors(); requestOtp(serverUrl, email).catch(() => {}) }}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400"
          >
            Resend code
          </button>
        </form>
      </div>
    )
  }

  // ── Step 4: Vault list ────────────────────────────────────────────────────

  return (
    <div>
      {header}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Choose a vault</h3>
        <button
          type="button"
          onClick={() => { refreshServerVaults().catch(() => {}); clearErrors() }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ↺ Refresh
        </button>
      </div>

      {serverVaults.length === 0 && !serverLoading && (
        <p className="mb-3 text-xs text-zinc-500">No vaults yet. Create one below.</p>
      )}

      <div className="mb-3 space-y-1.5">
        {serverVaults.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onVaultSelected(v)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-left transition hover:border-indigo-500 hover:bg-zinc-700"
          >
            <div>
              <p className="text-sm font-medium text-white">{v.name}</p>
              <p className="text-xs text-zinc-500">
                {v.role === 'owner' ? 'Owner' : 'Member'} ·{' '}
                {v.member_count} member{v.member_count !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="text-zinc-500">›</span>
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {displayError && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">{displayError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowNewVault(false); clearErrors() }}
              className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVault}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {creatingVault ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewVault(true)}
          className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
        >
          + New vault
        </button>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full text-xs text-zinc-600 hover:text-zinc-400"
      >
        Cancel
      </button>
    </div>
  )
}
