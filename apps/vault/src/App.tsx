import { ThemeProvider } from '@roko/ui/ThemeProvider'
import { useVault, VaultProvider } from '@roko/vault-core/components/VaultProvider'
import { UnlockScreen } from '@roko/vault-core/components/UnlockScreen'
import { VaultDashboard } from '@roko/vault-core/components/VaultDashboard'

const DEFAULT_SERVER = import.meta.env.VITE_ORG_SERVER

function VaultApp() {
  const { status, org } = useVault()

  // The admin console is its own app, served by the org server at /admin.
  const openAdmin = org.session
    ? () => window.open(`${org.session!.serverUrl}/admin/`, '_blank', 'noopener,noreferrer')
    : undefined

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
          <p className="text-sm text-tertiary">Loading vault…</p>
        </div>
      </div>
    )
  }
  if (status === 'unlocked') return <VaultDashboard onOpenAdmin={openAdmin} />
  return <UnlockScreen onOpenAdmin={openAdmin} defaultServerUrl={DEFAULT_SERVER} />
}

export function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <VaultApp />
      </VaultProvider>
    </ThemeProvider>
  )
}
