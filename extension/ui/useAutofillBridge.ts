import { useEffect } from 'react'
import { useVault } from '@components/VaultProvider'
import { exportKey } from '@/lib/crypto'

/**
 * Bridges the unlocked vault key from the React provider to the background
 * service worker. The background reads `rokoKey` from chrome.storage.session to
 * decrypt the vault for autofill / passkeys when no UI page is open. We export
 * the raw key on unlock and remove it on lock.
 */
export function useAutofillBridge(): void {
  const { cryptoKey } = useVault()
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (cryptoKey) {
          const raw = await exportKey(cryptoKey)
          if (!cancelled) await chrome.storage.session.set({ rokoKey: raw })
        } else {
          await chrome.storage.session.remove('rokoKey')
        }
      } catch {
        /* storage.session unavailable — autofill simply stays locked */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cryptoKey])
}
