import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ThemeProvider, useTheme } from '@roko/ui/ThemeProvider'
import { RokoLogo } from '@roko/ui/RokoLogo'
import { Button } from '@roko/ui/components/base/buttons/button'
import { useVault, VaultProvider } from '@roko/vault-core/components/VaultProvider'
import { OrgSignIn, OrgUnlock } from '@roko/vault-core/components/OrgAccess'
import { AlertTriangle, Lock01, LogOut01, Moon01, RefreshCw01, Sun } from '@untitledui/icons'
import * as api from '@roko/vault-core/lib/orgApi'
import type { SetupStatus } from '@roko/vault-core/lib/orgApi'
import { AdminConsole } from './AdminConsole'
import { SetupWizard } from './SetupWizard'

/**
 * The console manages the org server it is served from (the server bundles it
 * at /admin). During local development it talks to VITE_ORG_SERVER instead.
 */
const SERVER_URL =
  import.meta.env.VITE_ORG_SERVER || (import.meta.env.DEV ? 'http://localhost:4567' : window.location.origin)

const pill =
  'inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-[13px] font-semibold text-[var(--paper)] transition hover:border-[var(--paper)]'

function Shell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="grid min-h-screen grid-cols-1 bg-primary lg:grid-cols-[420px_1fr]">
      <aside className="roko-blueprint hidden min-h-screen flex-col justify-between px-11 py-10 lg:flex" style={{ borderRight: '1px solid rgb(255 255 255 / 0.07)' }}>
        <RokoLogo size={30} tone="onDark" />
        <div>
          <p className="roko-eyebrow mb-4">Admin console</p>
          <h2 className="mb-3.5 text-4xl font-bold leading-[1.08] text-[var(--paper)]">
            Manage your <em>org</em>.
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--ink-300)]">
            Add people, create vaults and decide who can open, edit and download each one. Vault keys are shared from
            this browser; the server never sees them.
          </p>
        </div>
        <div className="font-mono text-xs text-[var(--ink-500)]">{SERVER_URL.replace(/^https?:\/\//, '')}</div>
      </aside>
      <main className="relative flex flex-col items-center justify-center px-6 py-16 sm:px-12">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="absolute right-6 top-6 grid size-9 place-items-center rounded-full border border-border-primary bg-primary text-secondary transition hover:text-primary"
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon01 className="size-3.5" />}
        </button>
        <div className="w-full max-w-[400px]">
          <div className="mb-6 lg:hidden">
            <RokoLogo size={28} />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Ask the server whether it still needs first-run setup. */
function useSetupStatus() {
  const [setup, setSetup] = useState<SetupStatus | 'unreachable' | null>(null)
  const load = useCallback(() => {
    api.setup
      .status(SERVER_URL)
      .then(setSetup)
      .catch((err) => {
        // A server from before the setup wizard has no /api/setup: it is set up.
        if (err instanceof api.OrgApiError && err.status === 404) setSetup({ state: 'complete', orgName: '', mail: 'smtp' })
        else setSetup('unreachable')
      })
  }, [])
  useEffect(load, [load])
  const check = () => {
    setSetup(null)
    load()
  }
  return { setup, setSetup, check }
}

function AdminApp() {
  const { status, org, lock, orgSignOut } = useVault()
  const { setup, setSetup, check } = useSetupStatus()

  if (status === 'checking' || setup === null) return null

  if (setup === 'unreachable') {
    return (
      <Shell>
        <p className="roko-eyebrow mb-3.5">Org admin</p>
        <h1 className="mb-2 text-[30px] font-bold leading-tight">Can&apos;t reach the server</h1>
        <p className="mb-6 flex items-start gap-2 text-sm text-tertiary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {SERVER_URL} did not answer. Check that it is running.
        </p>
        <Button size="sm" color="secondary" iconLeading={RefreshCw01} onClick={check}>
          Try again
        </Button>
      </Shell>
    )
  }

  const finishSetup = () => setSetup({ ...setup, state: 'complete' })
  const isAdminUnlocked = !!org.privateKey && org.me?.role === 'admin'

  // A brand-new server: claim it. (Any session saved for this address is stale.)
  if (setup.state === 'needs-admin') return <SetupWizard serverUrl={SERVER_URL} status={setup} onDone={finishSetup} />
  // Admin exists but the wizard wasn't finished: sign in, then resume it.
  if (setup.state === 'in-progress' && isAdminUnlocked) {
    return <SetupWizard serverUrl={SERVER_URL} status={setup} onDone={finishSetup} />
  }

  if (org.phase === 'signed-out') {
    return (
      <Shell>
        <OrgSignIn
          fixedServerUrl={SERVER_URL}
          eyebrow={setup.state === 'in-progress' ? 'Finish setup' : 'Org admin'}
          title={setup.state === 'in-progress' ? 'Sign in to continue setup' : 'Sign in to manage'}
        />
      </Shell>
    )
  }
  if (org.phase === 'locked' || !org.privateKey) {
    return (
      <Shell>
        <OrgUnlock />
      </Shell>
    )
  }
  if (org.me?.role !== 'admin') {
    return (
      <Shell>
        <p className="roko-eyebrow mb-3.5">Org admin</p>
        <h1 className="mb-2 text-[30px] font-bold leading-tight">Admins only</h1>
        <p className="mb-6 text-sm text-tertiary">
          {org.me?.email} is not an admin of this org. Use the RokoPW vault app to open the vaults shared with you.
        </p>
        <Button size="sm" color="secondary" iconLeading={LogOut01} onClick={() => void orgSignOut()}>
          Sign out
        </Button>
      </Shell>
    )
  }

  return (
    <AdminConsole
      headerActions={
        <>
          <button type="button" className={pill} onClick={lock} title="Lock: forget keys until you enter your password again">
            <Lock01 className="size-4" /> Lock
          </button>
          <button type="button" className={pill} onClick={() => void orgSignOut()}>
            <LogOut01 className="size-4" /> Sign out
          </button>
        </>
      }
    />
  )
}

export function App() {
  return (
    <ThemeProvider>
      <VaultProvider forceMode="org">
        <AdminApp />
      </VaultProvider>
    </ThemeProvider>
  )
}
