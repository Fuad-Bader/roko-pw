import { useEffect } from 'react'
import { useVault } from '@components/VaultProvider'
import { exportKey } from '@/lib/crypto'

/**
 * Bridges the unlocked vault key from the React provider to the background
 * service worker. The background reads `rokoKey` from chrome.storage.session to
 * decrypt the vault for autofill / passkeys when no UI page is open. We export
 * the raw key on unlock and remove it on lock.
 */
/**
 * Read the raw vault key cached in chrome.storage.session, if the browser is
 * still open (session storage is wiped when the browser quits). Passed to
 * <VaultProvider restoreKey={…}> so the popup/vault page reopens already
 * unlocked instead of prompting for the master password every time.
 */
export async function loadSessionKey(): Promise<string | null> {
  try {
    const { rokoKey } = await chrome.storage.session.get('rokoKey')
    return rokoKey ?? null
  } catch {
    return null
  }
}

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
