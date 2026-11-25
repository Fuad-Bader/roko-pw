import { useState } from 'react'
import { useVault, VaultProvider } from '@components/VaultProvider'
import { UnlockScreen } from '@components/UnlockScreen'
import { VaultDashboard } from '@components/VaultDashboard'
import { AdminConsole } from '@components/AdminConsole'
import { TitleBar } from './components/TitleBar'

function VaultApp() {
  const { status, org } = useVault()
  const [adminOpen, setAdminOpen] = useState(false)

  if (status === 'checking') {
    return (
      <div className="flex flex-1 items-center justify-center bg-primary">
        <div className="size-10 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
      </div>
    )
  }

  if (adminOpen && org.privateKey && org.me?.role === 'admin') return <AdminConsole onClose={() => setAdminOpen(false)} />
  if (status === 'unlocked') return <VaultDashboard onOpenAdmin={() => setAdminOpen(true)} />
  return <UnlockScreen onOpenAdmin={() => setAdminOpen(true)} />
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
