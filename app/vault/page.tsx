'use client'

import { useVault } from '@/app/components/VaultProvider'
import { UnlockScreen } from '@/app/components/UnlockScreen'
import { VaultDashboard } from '@/app/components/VaultDashboard'

export default function VaultPage() {
  const { status } = useVault()

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
          <p className="text-sm text-zinc-500">Loading vault…</p>
        </div>
      </div>
    )
  }

  if (status === 'unlocked') {
    return <VaultDashboard />
  }

  return <UnlockScreen />
}
