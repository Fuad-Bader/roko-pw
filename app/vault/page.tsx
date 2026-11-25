'use client'

import { useState } from 'react'
import { useVault } from '@/app/components/VaultProvider'
import { UnlockScreen } from '@/app/components/UnlockScreen'
import { VaultDashboard } from '@/app/components/VaultDashboard'
import { AdminConsole } from '@/app/components/AdminConsole'

export default function VaultPage() {
  const { status, org } = useVault()
  const [adminOpen, setAdminOpen] = useState(false)

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

  // The admin console needs unlocked keys (to share vault keys).
  if (adminOpen && org.privateKey && org.me?.role === 'admin') {
    return <AdminConsole onClose={() => setAdminOpen(false)} />
  }

  if (status === 'unlocked') return <VaultDashboard onOpenAdmin={() => setAdminOpen(true)} />
  return <UnlockScreen onOpenAdmin={() => setAdminOpen(true)} />
}
