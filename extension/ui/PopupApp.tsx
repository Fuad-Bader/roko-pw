import { useEffect, useState } from 'react'
import { useVault, VaultProvider } from '@components/VaultProvider'
import { ThemeProvider } from '@components/ThemeProvider'
import type { VaultEntry } from '@/lib/types'
import { useAutofillBridge } from './useAutofillBridge'

// ─── helpers ───────────────────────────────────────────────────────────────

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function openFullVault() {
  chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') })
  window.close()
}

interface PasskeyMeta {
  credentialId: string
  rpId: string
  userName?: string
  userDisplayName?: string
}

// ─── screens ───────────────────────────────────────────────────────────────

function Locked() {
  const { unlock, error } = useVault()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!pw || busy) return
    setBusy(true)
    await unlock(pw)
    setBusy(false)
    setPw('')
  }

  return (
    <div style={S.pad}>
      <h1 style={S.brand}>
        <span style={{ color: 'var(--color-text-brand-primary, #7F56D9)' }}>Lila</span>Crypt
      </h1>
      <p style={S.muted}>Unlock your vault to autofill and manage credentials.</p>
      <input
        type="password"
        value={pw}
        autoFocus
        placeholder="Master password"
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        style={S.input}
      />
      {error && <p style={S.error}>{error}</p>}
      <button style={S.primary} disabled={busy} onClick={submit}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
      <button style={S.link} onClick={openFullVault}>
        Open full vault ↗
      </button>
    </div>
  )
}

function Empty() {
  return (
    <div style={S.pad}>
      <h1 style={S.brand}>
        <span style={{ color: 'var(--color-text-brand-primary, #7F56D9)' }}>Lila</span>Crypt
      </h1>
      <p style={S.muted}>No vault on this browser yet. Create or connect one in the full vault.</p>
      <button style={S.primary} onClick={openFullVault}>
        Open full vault ↗
      </button>
    </div>
  )
}

function Unlocked() {
  const { entries, lock } = useVault()
  const [tabUrl, setTabUrl] = useState('')
  const [passkeys, setPasskeys] = useState<PasskeyMeta[]>([])
  const [confirmId, setConfirmId] = useState('')
  const [toast, setToast] = useState('')

  const loadPasskeys = () =>
    chrome.runtime
      .sendMessage({ type: 'GET_PASSKEYS' })
      .then((r) => setPasskeys(r?.passkeys ?? []))
      .catch(() => setPasskeys([]))

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabUrl(tabs[0]?.url ?? '')
    })
    loadPasskeys()
  }, [])

  const removePasskey = async (credentialId: string) => {
    if (confirmId !== credentialId) {
      setConfirmId(credentialId)
      setTimeout(() => setConfirmId((c) => (c === credentialId ? '' : c)), 2500)
      return
    }
    setConfirmId('')
    await chrome.runtime.sendMessage({ type: 'DELETE_PASSKEY', credentialId }).catch(() => {})
    await loadPasskeys()
  }

  const host = hostnameOf(tabUrl)
  const logins = entries.filter((e) => !e.deletedAt && (e.type ?? 'login') === 'login')
  const matches = host ? logins.filter((e) => hostnameOf(e.url) === host) : []
  const list = matches.length > 0 ? matches : logins

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 1400)
  }

  const fill = async (entry: VaultEntry) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id != null) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'FILL_FORM', entry }).catch(() => {})
      window.close()
    }
  }

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    showToast(`Copied ${label}`)
  }

  return (
    <div>
      <div style={S.header}>
        <span style={S.brandSm}>
          <span style={{ color: 'var(--color-text-brand-primary, #7F56D9)' }}>Lila</span>Crypt
        </span>
        <button style={S.lockBtn} onClick={lock} title="Lock vault">
          🔒 Lock
        </button>
      </div>

      <div style={S.pad}>
        <p style={S.heading}>
          {matches.length > 0 ? `Matches for ${host}` : 'All logins'}
        </p>

        {list.length === 0 && <p style={S.muted}>No logins yet.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.slice(0, 12).map((e) => (
            <div key={e.id} style={S.card}>
              <div style={S.cardTitle}>{e.title || e.url || 'Untitled'}</div>
              <div style={S.cardUser}>{e.username}</div>
              <div style={S.cardActions}>
                <button style={S.fill} onClick={() => fill(e)}>
                  Fill ↗
                </button>
                <button style={S.ghost} onClick={() => copy(e.username, 'user')}>
                  User
                </button>
                <button style={S.ghost} onClick={() => copy(e.password, 'password')}>
                  Pwd
                </button>
              </div>
            </div>
          ))}
        </div>

        {passkeys.length > 0 && (
          <>
            <p style={{ ...S.heading, marginTop: 16 }}>Passkeys</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {passkeys.map((pk) => (
                <div key={pk.credentialId} style={S.card}>
                  <div style={S.cardTitle}>🔐 {pk.rpId}</div>
                  <div style={S.cardUser}>{pk.userDisplayName || pk.userName || ''}</div>
                  <div style={S.cardActions}>
                    <button style={S.ghost} onClick={() => removePasskey(pk.credentialId)}>
                      {confirmId === pk.credentialId ? '✓ Confirm remove' : '🗑 Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button style={{ ...S.primary, marginTop: 16 }} onClick={openFullVault}>
          Open full vault ↗
        </button>
      </div>

      {toast && <div style={S.toastBox}>{toast}</div>}
    </div>
  )
}

function Router() {
  const { status } = useVault()
  useAutofillBridge()

  if (status === 'checking') {
    return (
      <div style={{ ...S.pad, textAlign: 'center', color: 'var(--color-text-tertiary, #888)' }}>
        Loading…
      </div>
    )
  }
  if (status === 'empty') return <Empty />
  if (status === 'unlocked') return <Unlocked />
  return <Locked />
}

export function PopupApp() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <div style={S.shell}>
          <Router />
        </div>
      </VaultProvider>
    </ThemeProvider>
  )
}

// ─── inline styles (popup is tiny, kept self-contained) ──────────────────────

const S: Record<string, React.CSSProperties> = {
  shell: {
    width: 360,
    minHeight: 200,
    background: 'var(--color-bg-primary, #fff)',
    color: 'var(--color-text-primary, #18181b)',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  pad: { padding: 16 },
  brand: { fontSize: 22, fontWeight: 700, margin: '4px 0 8px' },
  brandSm: { fontSize: 15, fontWeight: 700 },
  muted: { fontSize: 13, color: 'var(--color-text-tertiary, #71717a)', margin: '0 0 12px' },
  heading: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    color: 'var(--color-text-tertiary, #71717a)',
    margin: '0 0 8px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 40,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border-primary, #d4d4d8)',
    background: 'var(--color-bg-primary, #fff)',
    color: 'inherit',
    fontSize: 14,
    marginBottom: 8,
  },
  primary: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    border: 'none',
    background: 'var(--color-bg-brand-solid, #7F56D9)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  link: {
    width: '100%',
    marginTop: 8,
    background: 'none',
    border: 'none',
    color: 'var(--color-text-brand-primary, #7F56D9)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--color-border-secondary, #e4e4e7)',
  },
  lockBtn: {
    background: 'none',
    border: '1px solid var(--color-border-primary, #d4d4d8)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    cursor: 'pointer',
    color: 'inherit',
  },
  card: {
    border: '1px solid var(--color-border-secondary, #e4e4e7)',
    borderRadius: 8,
    padding: 10,
  },
  cardTitle: { fontSize: 13, fontWeight: 600 },
  cardUser: { fontSize: 12, color: 'var(--color-text-tertiary, #71717a)', marginBottom: 6 },
  cardActions: { display: 'flex', gap: 6 },
  fill: {
    background: 'var(--color-bg-brand-solid, #7F56D9)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  ghost: {
    background: 'none',
    border: '1px solid var(--color-border-primary, #d4d4d8)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    color: 'inherit',
  },
  error: { fontSize: 12, color: '#dc2626', margin: '0 0 8px' },
  toastBox: {
    position: 'fixed',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#16a34a',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
  },
}
