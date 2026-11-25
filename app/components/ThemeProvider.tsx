'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// The accent colour is fixed to Roko ember (see styles/theme.css); only light/dark is user-selectable.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('roko-theme') as Theme | null
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
    // Clean up the old accent preference from before the Roko re-theme.
    localStorage.removeItem('roko-accent')
    document.documentElement.removeAttribute('data-accent')
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('dark-mode', theme === 'dark')
    localStorage.setItem('roko-theme', theme)
  }, [theme, mounted])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
