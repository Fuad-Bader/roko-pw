'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import { Button } from '@/components/base/buttons/button'

// 'url' → 'email' → 'otp' establish a server session (skipped if already
// connected); 'name' uploads the current vault; 'done' confirms.
type Step = 'url' | 'email' | 'otp' | 'name' | 'done'

interface Props {
  /** Called after a successful upload (or when the user backs out). */
  onClose: () => void
}

const inputCls =
  'w-full rounded-lg border border-border-primary bg-tertiary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition focus:border-border-brand focus:ring-1 focus:ring-brand'

export function UploadToServer({ onClose }: Props) {
  const {
    serverSession,
    serverLoading,
    probeServer,
    login,
    verifyOtp,
    uploadVaultToServer,
    error,
    clearError,
  } = useVault()

  const [step, setStep] = useState<Step>(serverSession ? 'name' : 'url')
  const [serverUrl, setServerUrl] = useState(serverSession?.serverUrl ?? '')
  const [serverName, setServerName] = useState('')
  const [email, setEmail] = useState(serverSession?.email ?? '')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [vaultName, setVaultName] = useState('My Vault')
  const [localError, setLocalError] = useState('')
  const [busy, setBusy] = useState(false)

  const displayError = localError || error
  const clearErrors = () => { setLocalError(''); clearError() }

  const handleProbe = async (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()
    const url = serverUrl.trim().replace(/\/$/, '')
    if (!url) return
    setBusy(true)
    try {
      const name = await probeServer(url)
      setServerUrl(url)
      setServerName(name)
      setStep('email')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not connect to server')
    } finally {
      setBusy(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()
    try {
      await login(serverUrl, email, password)
      setStep('otp')
    } catch { /* error shown via context */ }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()
    try {
      await verifyOtp(serverUrl, email, otp.trim(), password)
      setStep('name')
    } catch { /* error shown via context */ }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()
    setBusy(true)
    try {
      await uploadVaultToServer(vaultName)
      setStep('done')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const errorBox = displayError && (
    <p className="rounded-lg bg-error-primary px-3 py-2 text-xs text-error-primary">{displayError}</p>
  )

  if (step === 'url') {
    return (
      <form onSubmit={handleProbe} className="space-y-3">
        <p className="text-xs text-quaternary">Enter the address of the sync server to upload to.</p>
        <input
          type="url"
          autoFocus
          placeholder="https://vault.example.com"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          required
          className={inputCls}
        />
        {errorBox}
        <div className="flex gap-2">
          <Button type="button" onClick={onClose} color="secondary" size="sm" className="flex-1">Cancel</Button>
          <Button type="submit" isDisabled={busy} isLoading={busy} color="primary" size="sm" className="flex-1">Connect</Button>
        </div>
      </form>
    )
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleLogin} className="space-y-3">
        <p className="text-xs text-quaternary">
          Sign in to <span className="text-secondary">{serverName || serverUrl}</span>. We&apos;ll email you a one-time code.
        </p>
        <input type="email" autoFocus autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        <input type="password" autoComplete="current-password" placeholder="Account password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
        <p className="text-xs text-quaternary">New here? Pick a password — we&apos;ll create your account after you verify your email.</p>
        {errorBox}
        <div className="flex gap-2">
          <Button type="button" onClick={() => { clearErrors(); setStep('url') }} color="secondary" size="sm" className="flex-1">Back</Button>
          <Button type="submit" isDisabled={serverLoading} isLoading={serverLoading} color="primary" size="sm" className="flex-1">Continue</Button>
        </div>
      </form>
    )
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerify} className="space-y-3">
        <p className="text-xs text-quaternary">Check <span className="text-secondary">{email}</span> for your 6-digit code.</p>
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
        {errorBox}
        <div className="flex gap-2">
          <Button type="button" onClick={() => { clearErrors(); setOtp(''); setStep('email') }} color="secondary" size="sm" className="flex-1">Back</Button>
          <Button type="submit" isDisabled={serverLoading || otp.length !== 6} isLoading={serverLoading} color="primary" size="sm" className="flex-1">Verify</Button>
        </div>
      </form>
    )
  }

  if (step === 'name') {
    return (
      <form onSubmit={handleUpload} className="space-y-3">
        <p className="text-xs text-quaternary">
          Connected to <span className="text-secondary">{serverSession?.serverUrl ?? serverUrl}</span>. Give this vault a name on the server — your entries are uploaded encrypted, and your master password keeps unlocking it.
        </p>
        <input type="text" autoFocus placeholder="My Vault" value={vaultName} onChange={(e) => setVaultName(e.target.value)} className={inputCls} />
        {errorBox}
        <div className="flex gap-2">
          <Button type="button" onClick={onClose} color="secondary" size="sm" className="flex-1">Cancel</Button>
          <Button type="submit" isDisabled={busy} isLoading={busy} color="primary" size="sm" className="flex-1">⬆ Upload vault</Button>
        </div>
      </form>
    )
  }

  // step === 'done'
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-success-primary px-3 py-2 text-xs text-success-primary">
        ✓ Vault uploaded. It now syncs to {serverSession?.serverUrl ?? serverUrl}.
      </p>
      <Button type="button" onClick={onClose} color="secondary" size="sm">Done</Button>
    </div>
  )
}
