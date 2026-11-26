import { useVault, VaultProvider } from '@roko/vault-core/components/VaultProvider'
import { UnlockScreen } from '@roko/vault-core/components/UnlockScreen'
import { VaultDashboard } from '@roko/vault-core/components/VaultDashboard'
import { TitleBar } from './components/TitleBar'

function VaultApp() {
  const { status, org } = useVault()
  // The admin console is served by the org server; links open in the system browser.
  const openAdmin = org.session ? () => window.open(`${org.session!.serverUrl}/admin/`) : undefined

  if (status === 'checking') {
    return (
      <div className="flex flex-1 items-center justify-center bg-primary">
        <div className="size-10 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
      </div>
    )
  }
  if (status === 'unlocked') return <VaultDashboard onOpenAdmin={openAdmin} />
  return <UnlockScreen onOpenAdmin={openAdmin} />
}

export function App() {
  return (
    <VaultProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <VaultApp />
        </div>
      </div>
    </VaultProvider>
  )
}
