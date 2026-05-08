'use client'

import { useVault } from '@/app/components/VaultProvider'
import { UnlockScreen } from '@/app/components/UnlockScreen'
import { VaultDashboard } from '@/app/components/VaultDashboard'

export default function VaultPage() {
  const { status } = useVault()

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

  if (status === 'unlocked') {
    return <VaultDashboard />
  }

  return <UnlockScreen />
}
