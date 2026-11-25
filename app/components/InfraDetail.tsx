'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CredentialTemplate, VaultEntry } from '@/lib/types'
import {
  DEFAULT_PORT,
  downloadTextFile,
  inspectPrivateKey,
  keyFileName,
  publicKeyFingerprint,
  rdpFile,
  slugify,
  sshCommand,
  sshConfigBlock,
  usesPreSharedKey,
  vpnProtocolMeta,
} from '@/lib/infra'
import { Button } from '@/components/base/buttons/button'
import { Check, Copy01, Download01, Eye, EyeOff, Terminal } from '@untitledui/icons'
import { FieldLabel, FieldRow } from './FieldRow'

/** Detail fields + actions for SSH, RDP and VPN entries. */
export function InfraDetail({ entry }: { entry: VaultEntry }) {
  if (entry.type === 'ssh') return <SshDetail entry={entry} />
  if (entry.type === 'rdp') return <RdpDetail entry={entry} />
  if (entry.type === 'vpn') return <VpnDetail entry={entry} />
  return null
}

// ─── SSH ──────────────────────────────────────────────────────────────────────

function SshDetail({ entry }: { entry: VaultEntry }) {
  const usesKey = entry.sshAuth !== 'password' && !!entry.privateKey
  const keyInfo = useMemo(() => (entry.privateKey ? inspectPrivateKey(entry.privateKey) : null), [entry.privateKey])
  // Prefer the stored public key; fall back to the one embedded in an OpenSSH private key.
  const publicKey = entry.publicKey?.trim() || keyInfo?.publicKey || ''
  const fingerprint = useFingerprint(publicKey)
  const keyFile = keyFileName(entry)
  const [downloaded, setDownloaded] = useState(false)

  return (
    <>
      {entry.host && (
        <>
          <CommandPreview command={sshCommand(entry)} />
          <ActionRow>
            <CopyButton label="Copy SSH command" value={sshCommand(entry)} />
            <CopyButton label="Copy ~/.ssh/config" value={sshConfigBlock(entry)} />
            {usesKey && (
              <Button
                type="button"
                size="sm"
                color="secondary"
                iconLeading={Download01}
                onClick={() => {
                  downloadTextFile(keyFile, entry.privateKey!)
                  setDownloaded(true)
                }}
              >
                Download key
              </Button>
            )}
          </ActionRow>
        </>
      )}
      {!entry.host && usesKey && (
        <ActionRow>
          <Button
            type="button"
            size="sm"
            color="secondary"
            iconLeading={Download01}
            onClick={() => {
              downloadTextFile(keyFile, entry.privateKey!)
              setDownloaded(true)
            }}
          >
            Download key
          </Button>
          {publicKey && <CopyButton label="Copy public key" value={publicKey} />}
        </ActionRow>
      )}
      {downloaded && (
        <Hint>
          Saved as <code>{keyFile}</code>. Move it to <code>~/.ssh/</code> and run{' '}
          <code>chmod 600 ~/.ssh/{keyFile}</code>. The downloaded file is not encrypted by RokoPW.
        </Hint>
      )}

      {entry.host && (
        <TwoCol>
          <FieldRow label="Host" value={entry.host} mono />
          <FieldRow label="Port" value={entry.port || DEFAULT_PORT.ssh} mono />
        </TwoCol>
      )}
      {entry.username && <FieldRow label="Username" value={entry.username} mono />}
      {entry.jumpHost && <FieldRow label="Jump host" value={entry.jumpHost} mono />}
      {entry.sshAuth === 'password' && entry.password && <FieldRow label="Password" value={entry.password} secret />}

      {usesKey && (
        <>
          <SecretBlock label="Private key" value={entry.privateKey!} />
          {keyInfo && (
            <KeyFacts
              facts={[
                ['Type', keyInfo.algorithm ?? (keyInfo.format === 'unknown' ? 'Unrecognised' : keyInfo.format.toUpperCase())],
                [
                  'Protection',
                  keyInfo.encrypted === true ? 'Passphrase' : keyInfo.encrypted === false ? 'None' : 'Unknown',
                ],
                ...(fingerprint ? ([['Fingerprint', fingerprint]] as [string, string][]) : []),
              ]}
              warn={keyInfo.encrypted === false ? 'This key has no passphrase. Anyone who gets the file can use it.' : undefined}
            />
          )}
          {entry.passphrase && <FieldRow label="Key passphrase" value={entry.passphrase} secret />}
        </>
      )}
      {publicKey && (
        <CodeRow label={entry.publicKey?.trim() ? 'Public key' : 'Public key (from private key)'} value={publicKey} />
      )}
    </>
  )
}

function useFingerprint(publicKey: string): string | null {
  const [result, setResult] = useState<{ key: string; fp: string | null } | null>(null)
  useEffect(() => {
    if (!publicKey) return
    let cancelled = false
    publicKeyFingerprint(publicKey).then((fp) => {
      if (!cancelled) setResult({ key: publicKey, fp })
    })
    return () => {
      cancelled = true
    }
  }, [publicKey])
  return result && result.key === publicKey ? result.fp : null
}

// ─── RDP ──────────────────────────────────────────────────────────────────────

function RdpDetail({ entry }: { entry: VaultEntry }) {
  const [downloaded, setDownloaded] = useState(false)
  const fileName = `${slugify(entry.title, 'remote-desktop')}.rdp`
  return (
    <>
      <ActionRow>
        <Button
          type="button"
          size="sm"
          color="primary"
          iconLeading={Download01}
          onClick={() => {
            downloadTextFile(fileName, rdpFile(entry), 'application/x-rdp')
            setDownloaded(true)
          }}
        >
          Download .rdp file
        </Button>
        {entry.password && <CopyButton label="Copy password" value={entry.password} />}
      </ActionRow>
      {downloaded && (
        <Hint>
          Open <code>{fileName}</code> with Remote Desktop. The password isn&apos;t stored in the file, so copy it
          here and paste it when Windows asks.
        </Hint>
      )}

      <TwoCol>
        <FieldRow label="Host" value={entry.host ?? ''} mono />
        <FieldRow label="Port" value={entry.port || DEFAULT_PORT.rdp} mono />
      </TwoCol>
      {(entry.domain || entry.username) && (
        <TwoCol even>
          {entry.domain ? <FieldRow label="Domain" value={entry.domain} /> : <span />}
          {entry.username ? <FieldRow label="Username" value={entry.username} /> : <span />}
        </TwoCol>
      )}
      {entry.password && <FieldRow label="Password" value={entry.password} secret />}
      {entry.gateway && <FieldRow label="Remote Desktop Gateway" value={entry.gateway} mono />}
    </>
  )
}

// ─── VPN ──────────────────────────────────────────────────────────────────────

function VpnDetail({ entry }: { entry: VaultEntry }) {
  const proto = vpnProtocolMeta(entry.vpnProtocol)
  const fileName = `${slugify(entry.title, 'vpn')}.${proto.configExt}`
  const [downloaded, setDownloaded] = useState(false)
  return (
    <>
      {entry.config && (
        <ActionRow>
          <Button
            type="button"
            size="sm"
            color="primary"
            iconLeading={Download01}
            onClick={() => {
              downloadTextFile(fileName, entry.config!)
              setDownloaded(true)
            }}
          >
            Download {proto.configExt === 'txt' ? 'config' : `.${proto.configExt}`}
          </Button>
          <CopyButton label="Copy config" value={entry.config} />
        </ActionRow>
      )}
      {downloaded && (
        <Hint>
          Import <code>{fileName}</code> into your {proto.label} client. The downloaded file is not encrypted by
          RokoPW, so delete it once it&apos;s imported.
        </Hint>
      )}

      {entry.host ? (
        <TwoCol>
          <FieldRow label="Server" value={entry.host} mono />
          <FieldRow label="Protocol" value={proto.label} />
        </TwoCol>
      ) : (
        <FieldRow label="Protocol" value={proto.label} />
      )}
      {entry.username && <FieldRow label="Username" value={entry.username} />}
      {entry.password && <FieldRow label="Password" value={entry.password} secret />}
      {usesPreSharedKey(entry.vpnProtocol) && entry.preSharedKey && (
        <FieldRow label="Pre-shared key" value={entry.preSharedKey} secret />
      )}
      {entry.config && <SecretBlock label={proto.configLabel} value={entry.config} />}
    </>
  )
}

// ─── Template fields ──────────────────────────────────────────────────────────

/** Values of an item's template fields, each shown according to its kind. */
export function TemplateFieldsView({ entry, template }: { entry: VaultEntry; template?: CredentialTemplate }) {
  const values = entry.fields ?? {}
  if (!template) {
    // Template was deleted elsewhere (e.g. by another org member): still show the data.
    const raw = Object.entries(values).filter(([, v]) => v)
    if (!raw.length) return null
    return (
      <>
        <Hint>This item&apos;s template no longer exists. Its saved values are shown below.</Hint>
        {raw.map(([k, v]) => (v.includes('\n') ? <SecretBlock key={k} label={k} value={v} /> : <FieldRow key={k} label={k} value={v} secret />))}
      </>
    )
  }
  const shown = template.fields.filter((f) => values[f.id])
  if (!shown.length) return null
  return (
    <>
      {entry.type !== 'custom' && (
        <div style={{ font: '500 10px/1.4 var(--font-mono)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 14 }}>
          {template.name} fields
        </div>
      )}
      {shown.map((f) => {
        const v = values[f.id]
        switch (f.kind) {
          case 'secret':
            return <FieldRow key={f.id} label={f.label} value={v} secret />
          case 'secretMultiline':
            return <SecretBlock key={f.id} label={f.label} value={v} />
          case 'multiline':
            return <TextBlock key={f.id} label={f.label} value={v} />
          case 'url':
          case 'number':
            return <FieldRow key={f.id} label={f.label} value={v} mono />
          default:
            return <FieldRow key={f.id} label={f.label} value={v} />
        }
      })}
    </>
  )
}

/** Multi-line plain text that is fine to show (descriptions, runbooks). */
function TextBlock({ label, value }: { label: string; value: string }) {
  const [copied, copy] = useCopy()
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-secondary)', borderRadius: 10 }}>
        <div data-selectable style={{ flex: 1, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)' }}>{value}</div>
        <button type="button" onClick={() => copy(value)} title="Copy" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: copied ? 'var(--color-fg-success-primary)' : 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}>
          {copied ? <Check size={14} /> : <Copy01 size={14} />}
        </button>
      </div>
    </div>
  )
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
}

/** Two fields side by side: "narrow" puts a short value (port, protocol) in a fixed right column. */
function TwoCol({ children, even }: { children: React.ReactNode; even?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: even ? '1fr 1fr' : '1fr 130px', gap: 12 }}>{children}</div>
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="[&_code]:font-mono [&_code]:text-primary"
      style={{
        margin: 0,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--color-bg-brand-primary)',
        border: '1px solid var(--color-border-secondary)',
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </p>
  )
}

function useCopy(): [boolean, (value: string) => Promise<void>] {
  const [copied, setCopied] = useState(false)
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return [copied, copy]
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, copy] = useCopy()
  return (
    <Button type="button" size="sm" color="secondary" iconLeading={copied ? Check : Copy01} onClick={() => copy(value)}>
      {copied ? 'Copied' : label}
    </Button>
  )
}

/** The connect command, shown as a small Roko terminal. */
function CommandPreview({ command }: { command: string }) {
  const [copied, copy] = useCopy()
  return (
    <div className="roko-terminal" style={{ boxShadow: 'none', fontSize: 12.5 }}>
      <div className="roko-terminal-bar" style={{ padding: '8px 12px' }}>
        <Terminal size={13} />
        <span style={{ marginInlineStart: 0 }}>connect</span>
        <button
          type="button"
          onClick={() => copy(command)}
          title="Copy command"
          style={{ marginInlineStart: 'auto', border: 0, background: 'none', cursor: 'pointer', color: copied ? 'var(--circuit-500)' : 'var(--ink-300)', display: 'flex', padding: 2 }}
        >
          {copied ? <Check size={14} /> : <Copy01 size={14} />}
        </button>
      </div>
      <div className="roko-terminal-body" data-selectable style={{ padding: '12px 14px', lineHeight: 1.6 }}>
        <span className="roko-t-prompt">$ </span>
        <span className="roko-t-cmd">{command}</span>
      </div>
    </div>
  )
}

/** A multi-line secret (private key, VPN config): hidden until revealed. */
function SecretBlock({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, copy] = useCopy()
  const lines = value.trimEnd().split('\n').length
  const iconBtn: React.CSSProperties = {
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-fg-quaternary)',
    display: 'flex',
    padding: 2,
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <span style={{ flex: 1, font: '400 12px/1.5 var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
            {revealed ? `${lines} line${lines === 1 ? '' : 's'}` : `•••• ${lines} line${lines === 1 ? '' : 's'} hidden`}
          </span>
          <button type="button" onClick={() => setRevealed((v) => !v)} style={iconBtn} title={revealed ? 'Hide' : 'Show'}>
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={() => copy(value)}
            style={{ ...iconBtn, color: copied ? 'var(--color-fg-success-primary)' : iconBtn.color }}
            title="Copy"
          >
            {copied ? <Check size={14} /> : <Copy01 size={14} />}
          </button>
        </div>
        {revealed && (
          <pre
            data-selectable
            style={{
              margin: 0,
              padding: '10px 12px',
              borderTop: '1px solid var(--color-border-secondary)',
              maxHeight: 240,
              overflow: 'auto',
              font: '400 11.5px/1.55 var(--font-mono)',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre',
            }}
          >
            {value}
          </pre>
        )}
      </div>
    </div>
  )
}

/** Long single-line values (public keys) that should wrap instead of truncating. */
function CodeRow({ label, value }: { label: string; value: string }) {
  const [copied, copy] = useCopy()
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '9px 12px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 10,
        }}
      >
        <code
          data-selectable
          style={{ flex: 1, font: '400 11.5px/1.55 var(--font-mono)', color: 'var(--color-text-primary)', wordBreak: 'break-all' }}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={() => copy(value)}
          title="Copy"
          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: copied ? 'var(--color-fg-success-primary)' : 'var(--color-fg-quaternary)', display: 'flex', padding: 2 }}
        >
          {copied ? <Check size={14} /> : <Copy01 size={14} />}
        </button>
      </div>
    </div>
  )
}

function KeyFacts({ facts, warn }: { facts: [string, string][]; warn?: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border-secondary)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '6px 16px',
        font: '400 12px/1.5 var(--font-mono)',
      }}
    >
      {facts.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>{k}</span>
          <span data-selectable style={{ color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
      {warn && (
        <span style={{ gridColumn: '1 / -1', color: 'var(--color-text-warning-primary)', fontFamily: 'var(--font-body)' }}>
          {warn}
        </span>
      )}
    </div>
  )
}
