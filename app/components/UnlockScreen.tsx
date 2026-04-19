'use client'

import { useState, type FormEvent } from 'react'
import { useVault } from './VaultProvider'
import { RecoverVault } from './RecoverVault'

type Mode = 'unlock' | 'create' | 'recover'

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
  } = useVault()
  const [mode, setMode] = useState<Mode>(status === 'empty' ? 'create' : 'unlock')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {logo}

        {/* Main card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <h2 className="mb-5 text-lg font-semibold text-white">
            {mode === 'unlock' ? 'Unlock your vault' : 'Create a new vault'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="password">
                Master password
              </label>
              <input
                id="password"
                type="password"
                autoFocus
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
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
                  placeholder="Re-enter master password"
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

        {/* Open from file */}
        <button
          type="button"
          onClick={handleImport}
          disabled={importLoading}
          className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {importLoading ? 'Opening…' : '📂 Open vault from file'}
        </button>

        {/* Storage backend toggle */}
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-medium text-zinc-400">Storage backend</p>
          <div className="flex gap-2">
            {(['local', 'remote'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => applySettings({ backend: b })}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  settings.backend === b
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {b === 'local' ? '💾 Local' : '☁️ Remote'}
              </button>
            ))}
          </div>
          {settings.backend === 'remote' && (
            <p className="mt-2 break-all text-xs text-zinc-500">
              Vault ID:{' '}
              <span className="font-mono text-zinc-300">{settings.vaultId}</span>
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          All encryption happens in your browser. The server never sees your passwords.
        </p>
      </div>
    </div>
  )
}
