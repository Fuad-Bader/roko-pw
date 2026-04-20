'use client'

import { useState } from 'react'
import { useVault } from './VaultProvider'
import { RecoverVault } from './RecoverVault'
import { ServerLogin } from './ServerLogin'
import type { VaultMeta } from '@/lib/types'

type Mode = 'unlock' | 'create' | 'recover' | 'server'

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

  // Called when user picks a vault from the server browser
  const handleVaultSelected = async (vault: VaultMeta) => {
    await applySettings({ backend: 'remote', vaultId: vault.id, serverUrl: settings.serverUrl })
    switchMode(vault.id ? 'unlock' : 'create')
  }

  const displayError = localError || error

  const logo = (
    <div className="mb-8 text-center">
      <div className="mb-3 inline-flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-3xl">
        🔐
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white">
        Roko
        <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          PW
        </span>
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Zero-trust password manager</p>
    </div>
  )

  // ── Recovery mode ─────────────────────────────────────────────────────────

  if (mode === 'recover') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm">
          {logo}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <RecoverVault onCancel={() => switchMode('unlock')} />
          </div>
        </div>
      </div>
    )
  }

  // ── Server connect / vault picker ─────────────────────────────────────────

  if (mode === 'server') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm">
          {logo}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <ServerLogin
              onVaultSelected={handleVaultSelected}
              onCancel={() => switchMode(status === 'empty' ? 'create' : 'unlock')}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Unlock / Create ───────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {logo}

        {/* Server banner when connected */}
        {serverSession && settings.backend === 'remote' && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-indigo-900/50 bg-indigo-950/40 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-indigo-400">🌐</span>
              <span className="truncate text-xs text-indigo-300">{serverSession.serverUrl}</span>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <button
                type="button"
                onClick={() => switchMode('server')}
                className="text-xs text-indigo-400 hover:text-indigo-200"
              >
                Switch vault
              </button>
              <span className="text-zinc-700">·</span>
              <button
                type="button"
                onClick={logoutServer}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <h2 className="mb-5 text-lg font-semibold text-white">
            {mode === 'unlock' ? 'Unlock your vault' : 'Create a new vault'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="password">
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {mode === 'create' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="confirm">
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {displayError && (
              <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-400">
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading
                ? mode === 'create'
                  ? 'Creating vault…'
                  : 'Unlocking…'
                : mode === 'create'
                  ? 'Create vault'
                  : 'Unlock'}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => switchMode(mode === 'unlock' ? 'create' : 'unlock')}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              {mode === 'unlock' ? 'Create a new vault instead' : 'I already have a vault'}
            </button>
            {mode === 'unlock' && (
              <button
                type="button"
                onClick={() => switchMode('recover')}
                className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              >
                Forgot password? Use recovery phrase
              </button>
            )}
          </div>
        </div>

        {/* Action row: file + server */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleImport}
            disabled={importLoading}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {importLoading ? 'Opening…' : '📂 Open from file'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('server')}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            🌐 {serverSession ? 'Switch server' : 'Connect to server'}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          All encryption happens locally. The server never sees your passwords.
        </p>
      </div>
    </div>
  )
}
