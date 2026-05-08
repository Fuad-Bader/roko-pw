import { useVault, VaultProvider } from '@components/VaultProvider'
import { UnlockScreen } from '@components/UnlockScreen'
import { VaultDashboard } from '@components/VaultDashboard'
import { TitleBar } from './components/TitleBar'

function VaultApp() {
  const { status } = useVault()

  if (status === 'checking') {
    return (
      <div className="flex flex-1 items-center justify-center bg-primary">
        <div className="size-10 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
      </div>
    )
  }

  if (status === 'unlocked') return <VaultDashboard />
  return <UnlockScreen />
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
