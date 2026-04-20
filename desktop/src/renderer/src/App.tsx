import { useVault, VaultProvider } from '@components/VaultProvider'
import { UnlockScreen } from '@components/UnlockScreen'
import { VaultDashboard } from '@components/VaultDashboard'

function VaultApp() {
  const { status } = useVault()

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (status === 'unlocked') return <VaultDashboard />
  return <UnlockScreen />
}

export function App() {
  return (
    <VaultProvider>
      <VaultApp />
    </VaultProvider>
  )
}
