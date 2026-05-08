'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type Accent = 'violet' | 'amber' | 'teal' | 'rose' | 'blue'

export interface ThemeContextValue {
  theme: Theme
  accent: Accent
  toggleTheme: () => void
  setAccent: (accent: Accent) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  accent: 'violet',
  toggleTheme: () => {},
  setAccent: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'violet', label: 'Violet', color: '#7F56D9' },
  { id: 'amber', label: 'Amber', color: '#D97706' },
  { id: 'teal', label: 'Teal', color: '#0D9488' },
  { id: 'rose', label: 'Rose', color: '#E11D48' },
  { id: 'blue', label: 'Blue', color: '#2563EB' },
]

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [accent, setAccentState] = useState<Accent>('violet')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('roko-theme') as Theme | null
    const savedAccent = localStorage.getItem('roko-accent') as Accent | null
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
    if (savedAccent) setAccentState(savedAccent)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark-mode')
    } else {
      html.classList.remove('dark-mode')
    }
    html.setAttribute('data-accent', accent)
    localStorage.setItem('roko-theme', theme)
    localStorage.setItem('roko-accent', accent)
  }, [theme, accent, mounted])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  const setAccent = (a: Accent) => setAccentState(a)

  return (
    <ThemeContext.Provider value={{ theme, accent, toggleTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}
