import { useVault, VaultProvider } from '@components/VaultProvider'
import { ThemeProvider } from '@components/ThemeProvider'
import { UnlockScreen } from '@components/UnlockScreen'
import { VaultDashboard } from '@components/VaultDashboard'
import { useAutofillBridge } from './useAutofillBridge'

// Mirrors desktop/src/renderer/src/App.tsx: reuse the web vault UI unchanged.
function VaultRouter() {
  const { status } = useVault()
  useAutofillBridge()

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

export function VaultApp() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-primary text-primary">
          <VaultRouter />
        </div>
      </VaultProvider>
    </ThemeProvider>
  )
}
