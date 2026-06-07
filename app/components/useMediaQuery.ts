'use client'

import { useEffect, useState } from 'react'

/**
 * Returns true when the given CSS media query currently matches. SSR-safe:
 * returns false until mounted on the client, then tracks changes. Used to drive
 * responsive inline styles (e.g. collapsing the vault dashboard into a single
 * column in the extension popup / on phones, and the landing page's mobile nav).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}
