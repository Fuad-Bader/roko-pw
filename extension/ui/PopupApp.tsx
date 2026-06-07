import { useEffect, useState } from 'react'
import { useVault, VaultProvider } from '@components/VaultProvider'
import { ThemeProvider } from '@components/ThemeProvider'
import { UnlockScreen } from '@components/UnlockScreen'
import { VaultDashboard } from '@components/VaultDashboard'
import type { VaultEntry } from '@/lib/types'
import { useAutofillBridge, loadSessionKey } from './useAutofillBridge'

// One surface: the popup hosts the full vault dashboard AND the autofill for the
// active tab. Unlocked → <VaultDashboard> (same component as the web app) with a
// floating autofill dock; otherwise → <UnlockScreen> (create / unlock / connect /
// recover). The same popup.html can also be opened in a tab (the dock's ⤢ Tab
// button) for flows where a native file dialog would otherwise close the popup.

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// ─── Floating autofill + pop-out dock (popup mode only) ──────────────────────

function AutofillDock({ isTab }: { isTab: boolean }) {
  const { entries, status } = useVault()
  const [host, setHost] = useState('')

  useEffect(() => {
    if (isTab) return
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((t) => setHost(hostnameOf(t[0]?.url ?? '')))
      .catch(() => {})
  }, [isTab])

  if (isTab) return null // running in a full tab — nothing to autofill

  const matches =
    status === 'unlocked' && host
      ? entries.filter(
          (e) => !e.deletedAt && (e.type ?? 'login') === 'login' && hostnameOf(e.url) === host,
        )
      : []

  const fill = async (entry: VaultEntry) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id != null) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'FILL_FORM', entry }).catch(() => {})
      window.close()
    }
  }

  const popOut = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })
    window.close()
  }

  return (
    <div style={dock.bar}>
      {matches.length > 0 && (
        <>
          <span style={dock.label}>Fill {host}</span>
          {matches.slice(0, 2).map((e) => (
            <button key={e.id} style={dock.fill} onClick={() => fill(e)} title={e.username}>
              ↗ {e.title || e.username}
            </button>
          ))}
          <span style={dock.divider} />
        </>
      )}
      <button
        style={dock.tab}
        onClick={popOut}
        title="Open in a full tab (needed for file import / export)"
      >
        ⤢ Tab
      </button>
    </div>
  )
}

// ─── Router ──────────────────────────────────────────────────────────────────

function Router() {
  const { status } = useVault()
  useAutofillBridge()

  if (status === 'checking') {
    return (
      <div style={center}>
        <div style={spinner} />
      </div>
    )
  }
  if (status === 'unlocked') return <VaultDashboard />
  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <UnlockScreen />
    </div>
  )
}

export function PopupApp() {
  const [isTab, setIsTab] = useState(false)

  useEffect(() => {
    // chrome.tabs.getCurrent() resolves to a Tab when this page runs in a tab,
    // and undefined inside the toolbar popup.
    chrome.tabs
      .getCurrent()
      .then((t) => setIsTab(!!t))
      .catch(() => {})
  }, [])

  return (
    <ThemeProvider>
      <VaultProvider restoreKey={loadSessionKey}>
        <div style={isTab ? shell.tab : shell.popup}>
          <Router />
          <AutofillDock isTab={isTab} />
        </div>
      </VaultProvider>
    </ThemeProvider>
  )
}

// ─── styles ──────────────────────────────────────────────────────────────────

// A fixed portrait 440×600 root makes the dashboard's `height: 100vh` resolve to
// 600 and fit the popup; 440px is under the dashboard's 700px breakpoint so it
// auto-stacks into a single navigable column. In a tab we fill the viewport.
const shell: Record<string, React.CSSProperties> = {
  popup: {
    width: 440,
    height: 600,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-bg-primary, #fff)',
    color: 'var(--color-text-primary, #18181b)',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  tab: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-bg-primary, #fff)',
    color: 'var(--color-text-primary, #18181b)',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
}

const center: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const spinner: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '2px solid var(--color-border-primary, #d4d4d8)',
  borderTopColor: 'var(--color-bg-brand-solid, #7F56D9)',
  animation: 'spin 0.7s linear infinite',
}

const dock: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 10,
    right: 10,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    maxWidth: 'calc(100% - 20px)',
    padding: '6px 8px',
    borderRadius: 10,
    background: 'var(--color-bg-primary, #fff)',
    border: '1px solid var(--color-border-secondary, #e4e4e7)',
    boxShadow: '0 6px 20px rgba(16,24,40,.18)',
    fontSize: 12,
  },
  label: { color: 'var(--color-text-tertiary, #71717a)', fontWeight: 600, whiteSpace: 'nowrap' },
  fill: {
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    background: 'var(--color-bg-brand-solid, #7F56D9)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    background: 'var(--color-border-secondary, #e4e4e7)',
    margin: '0 2px',
  },
  tab: {
    background: 'none',
    border: '1px solid var(--color-border-primary, #d4d4d8)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
    color: 'inherit',
    whiteSpace: 'nowrap',
  },
}
