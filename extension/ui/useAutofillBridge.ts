import { useEffect, useRef } from 'react'
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
  // Tracks whether we've actually held a key this mount, so we only clear the
  // cached key on a real lock — NOT on the initial null state before restore
  // runs (which would wipe the key we're about to rehydrate from).
  const hadKey = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (cryptoKey) {
          hadKey.current = true
          const raw = await exportKey(cryptoKey)
          if (!cancelled) await chrome.storage.session.set({ rokoKey: raw })
        } else if (hadKey.current) {
          // The vault was unlocked and is now locked → forget the cached key.
          hadKey.current = false
          await chrome.storage.session.remove('rokoKey')
        }
        // else: initial mount, no key yet — leave any cached key in place so the
        // provider's restoreKey can rehydrate the unlocked session.
      } catch {
        /* storage.session unavailable — autofill simply stays locked */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cryptoKey])
}
