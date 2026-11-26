/**
 * First-run setup wizard, shown by the admin console while the server is not
 * set up yet. Steps:
 *
 *   1. Organization   setup code (from the server log) + org name
 *   2. Admin account  the first admin; keys are created in this browser
 *   3. Sign-in        email delivery check + who may create accounts
 *   4. Vaults         first shared vaults
 *   5. Team           invite people and give them access
 *   → Done           summary, then the normal console
 *
 * Steps 1–2 run before anyone is signed in. If the page is reloaded after the
 * account exists, the console asks the admin to sign in and resumes at step 3.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@roko/ui/components/base/buttons/button'
import { RokoLogo } from '@roko/ui/RokoLogo'
import { useTheme } from '@roko/ui/ThemeProvider'
import { cx } from '@roko/ui/utils/cx'
import {
  ArrowLeft,
  ArrowRight,
  Building07,
  Check,
  CheckCircle,
  Database01,
  Globe01,
  Lock01,
  Moon01,
  Plus,
  ShieldTick,
  Sun,
  UserPlus01,
  XClose,
} from '@untitledui/icons'
import { useVault } from '@roko/vault-core/components/VaultProvider'
import * as api from '@roko/vault-core/lib/orgApi'
import type { AdminUser, AdminVault, OrgRole, OrgSettings, SetupStatus } from '@roko/vault-core/lib/orgApi'
import { ErrorNote, MailStatus, SignupPolicy, Switch } from './controls'
import { createOrgVault, invitePeople, parseEmails } from './orgActions'

type StepId = 'org' | 'account' | 'signin' | 'vaults' | 'team' | 'done'

const STEPS: Array<{ id: Exclude<StepId, 'done'>; label: string; hint: string }> = [
  { id: 'org', label: 'Organization', hint: 'Claim this server' },
  { id: 'account', label: 'Admin account', hint: 'Your sign-in and keys' },
  { id: 'signin', label: 'Sign-in & email', hint: 'Codes and sign-ups' },
  { id: 'vaults', label: 'Vaults', hint: 'Where secrets live' },
  { id: 'team', label: 'Your team', hint: 'Invite people' },
]

const VAULT_SUGGESTIONS = ['Infrastructure', 'Engineering', 'Production', 'Shared']

export const inputCls =
  'w-full rounded-[10px] border border-border-primary bg-primary px-3.5 py-2.5 text-sm text-primary shadow-xs outline-none transition placeholder:text-placeholder focus:border-border-brand focus:ring-1 focus:ring-brand'
const labelCls = 'mb-1.5 block text-[13px] font-medium text-secondary'

function errText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-tertiary">{hint}</p>}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepId }) {
  const index = current === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="flex flex-col gap-1">
      {STEPS.map((s, i) => {
        const state = i < index ? 'done' : i === index ? 'current' : 'todo'
        return (
          <li
            key={s.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cx(
              'flex items-center gap-3.5 rounded-[12px] px-3 py-2.5 transition',
              state === 'current' && 'bg-white/[0.06]',
            )}
          >
            <span
              className={cx(
                'grid size-8 shrink-0 place-items-center rounded-full border font-mono text-xs font-semibold',
                state === 'done' && 'border-transparent bg-ember-a20 text-[var(--ember-400)]',
                state === 'current' && 'border-[var(--ember-500)] text-[var(--paper)] shadow-[0_0_0_4px_var(--ember-a16)]',
                state === 'todo' && 'border-white/15 text-[var(--ink-400)]',
              )}
            >
              {state === 'done' ? <Check className="size-4" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cx('block text-sm font-semibold', state === 'todo' ? 'text-[var(--ink-400)]' : 'text-[var(--paper)]')}>
                {s.label}
              </span>
              <span className="block text-xs text-[var(--ink-400)]">{s.hint}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function WizardLayout({ step, serverUrl, orgName, children }: { step: StepId; serverUrl: string; orgName: string; children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const index = step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === step)
  return (
    <div className="grid min-h-screen grid-cols-1 bg-primary lg:grid-cols-[360px_1fr]">
      <aside
        className="roko-blueprint sticky top-0 hidden h-screen flex-col gap-10 overflow-y-auto px-8 py-10 lg:flex"
        style={{ borderRight: '1px solid rgb(255 255 255 / 0.07)' }}
      >
        <RokoLogo size={30} tone="onDark" />
        <div>
          <p className="roko-eyebrow mb-3">First-run setup</p>
          <h2 className="text-[26px] font-bold leading-[1.1] text-[var(--paper)]">
            {orgName ? (
              <>
                Set up <em>{orgName}</em>
              </>
            ) : (
              <>
                Set up your <em>org</em>
              </>
            )}
          </h2>
        </div>
        <Stepper current={step} />
        <div className="mt-auto flex items-center gap-2 font-mono text-xs text-[var(--ink-500)]">
          <Globe01 className="size-3.5" /> {serverUrl.replace(/^https?:\/\//, '')}
        </div>
      </aside>

      <main className="relative flex flex-col px-6 py-10 sm:px-12">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="absolute right-6 top-6 grid size-9 place-items-center rounded-full border border-border-primary bg-primary text-secondary transition hover:text-primary"
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon01 className="size-3.5" />}
        </button>

        {/* Compact progress for narrow screens */}
        <div className="mb-8 lg:hidden">
          <RokoLogo size={28} />
          {step !== 'done' && (
            <div className="mt-6">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
                Step {index + 1} of {STEPS.length} · {STEPS[index].label}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-quaternary">
                <div className="h-full rounded-full bg-brand-solid transition-all" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto my-auto w-full max-w-[520px]">{children}</div>
      </main>
    </div>
  )
}

function StepHeading({ n, title, sub }: { n?: number; title: string; sub: ReactNode }) {
  return (
    <div className="mb-7">
      {n !== undefined && <p className="roko-eyebrow mb-3.5 max-lg:hidden">Step {n} of {STEPS.length}</p>}
      <h1 className="mb-2 text-[30px] font-bold leading-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-tertiary">{sub}</p>
    </div>
  )
}

function Nav({
  onBack,
  onSkip,
  submitLabel = 'Continue',
  busy,
  disabled,
}: {
  onBack?: () => void
  onSkip?: () => void
  submitLabel?: string
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <div className="mt-8 flex items-center gap-3 border-t border-secondary pt-6">
      {onBack && (
        <Button type="button" color="tertiary" size="md" iconLeading={ArrowLeft} onClick={onBack} isDisabled={busy}>
          Back
        </Button>
      )}
      <div className="ml-auto flex items-center gap-3">
        {onSkip && (
          <Button type="button" color="link-gray" size="md" onClick={onSkip} isDisabled={busy}>
            Skip for now
          </Button>
        )}
        <Button type="submit" size="md" iconTrailing={ArrowRight} isLoading={busy} isDisabled={busy || disabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function OrgStep({
  serverUrl,
  initial,
  onNext,
}: {
  serverUrl: string
  initial: { setupCode: string; orgName: string }
  onNext: (v: { setupCode: string; orgName: string }) => void
}) {
  const [setupCode, setSetupCode] = useState(initial.setupCode)
  const [orgName, setOrgName] = useState(initial.orgName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!orgName.trim()) return setError('Enter your organization name.')
    setBusy(true)
    try {
      await api.setup.checkCode(serverUrl, setupCode)
      onNext({ setupCode, orgName: orgName.trim() })
    } catch (err) {
      setError(errText(err, 'Could not check the setup code.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepHeading n={1} title="Welcome to RokoPW" sub="This server is new. Claim it for your organization; you'll be its first admin." />
      <div className="flex flex-col gap-5">
        <Field
          id="setup-code"
          label="Setup code"
          hint={
            <>
              Printed in the server log when it starts, so only whoever runs the server can claim it. With Docker:{' '}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-secondary">docker compose logs server</code>
            </>
          }
        >
          <input
            id="setup-code"
            autoFocus
            className={`${inputCls} font-mono uppercase tracking-[0.2em]`}
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field id="org-name" label="Organization name" hint="Shown to everyone who signs in. You can change it later.">
          <input id="org-name" className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." autoComplete="organization" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Nav busy={busy} disabled={!setupCode.trim() || !orgName.trim()} />
    </form>
  )
}

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < 12) return { score: 0, label: 'At least 12 characters' }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (pw.length >= 20 || (pw.length >= 14 && kinds >= 3)) return { score: 3, label: 'Strong' }
  if (kinds >= 2) return { score: 2, label: 'Good' }
  return { score: 1, label: 'Fair: mix in numbers or symbols' }
}

function AccountStep({
  serverUrl,
  org,
  onBack,
  onNext,
}: {
  serverUrl: string
  org: { setupCode: string; orgName: string }
  onBack: () => void
  onNext: () => void
}) {
  const { orgSetupAdmin } = useVault()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const strength = passwordStrength(password)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (strength.score === 0) return setError('Use at least 12 characters for the admin password.')
    if (password !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    try {
      await orgSetupAdmin(serverUrl, { ...org, name, email, password })
      onNext()
    } catch (err) {
      setError(errText(err, 'Could not create the admin account.'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepHeading n={2} title="Create the admin account" sub={`You'll manage ${org.orgName}'s people and vaults with this account.`} />
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="admin-name" label="Full name">
            <input id="admin-name" autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
          </Field>
          <Field id="admin-email" label="Work email">
            <input id="admin-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@acme.com" autoComplete="username" />
          </Field>
        </div>
        <Field id="admin-password" label="Password">
          <input id="admin-password" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cx(
                    'h-1 flex-1 rounded-full transition-colors',
                    password && strength.score >= i
                      ? strength.score === 1 ? 'bg-warning-solid' : 'bg-success-solid'
                      : 'bg-quaternary',
                  )}
                />
              ))}
            </div>
            <span className="w-48 text-right text-xs text-tertiary">{password ? strength.label : 'At least 12 characters'}</span>
          </div>
        </Field>
        <Field id="admin-confirm" label="Confirm password">
          <input id="admin-confirm" type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="flex gap-3 rounded-[12px] border border-border-secondary bg-secondary p-3.5 text-[13px] leading-relaxed text-tertiary">
          <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" />
          <span>
            Your password never leaves this browser: it unlocks your encryption keys, which are created here when you continue.
            Nobody can reset it, so store it somewhere safe. Adding a second admin later protects you from being locked out.
          </span>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Nav onBack={busy ? undefined : onBack} busy={busy} submitLabel={busy ? 'Creating keys…' : 'Create account'} disabled={!email || !password || !confirm} />
    </form>
  )
}

function SignInStep({ settings, setSettings, onNext }: { settings: OrgSettings; setSettings: (s: OrgSettings) => void; onNext: () => void }) {
  const { org } = useVault()
  const session = org.session!
  const [allowSignups, setAllowSignups] = useState(settings.allowSignups)
  // Servers claimed through ADMIN_EMAILS skip step 1, so ask for the name here.
  const [askName] = useState(!settings.orgName)
  const [orgName, setOrgName] = useState(settings.orgName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (askName && !orgName.trim()) return setError('Enter your organization name.')
    setBusy(true)
    try {
      const patch: { orgName?: string; allowSignups?: boolean } = {}
      if (askName && orgName.trim() !== settings.orgName) patch.orgName = orgName.trim()
      if (!settings.allowSignupsLocked && allowSignups !== settings.allowSignups) patch.allowSignups = allowSignups
      if (Object.keys(patch).length) setSettings(await api.admin.updateSettings(session, patch))
      onNext()
    } catch (err) {
      setError(errText(err, 'Could not save.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepHeading n={3} title="Sign-in and email" sub="Everyone signs in with their password plus a code sent by email." />
      <div className="flex flex-col gap-6">
        {askName && (
          <Field id="org-name" label="Organization name" hint="Shown to everyone who signs in. You can change it later.">
            <input id="org-name" autoFocus className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." autoComplete="organization" />
          </Field>
        )}
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold text-secondary">Email delivery</h2>
          <MailStatus mail={settings.mail} email={org.me?.email ?? ''} onTest={async () => void (await api.admin.testEmail(session))} />
        </section>
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold text-secondary">Who can create an account</h2>
          <SignupPolicy allowSignups={allowSignups} locked={settings.allowSignupsLocked} onChange={setAllowSignups} />
        </section>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Nav busy={busy} />
    </form>
  )
}

function VaultsStep({
  vaults,
  users,
  reload,
  onBack,
  onNext,
}: {
  vaults: AdminVault[]
  users: AdminUser[]
  reload: () => Promise<void>
  onBack: () => void
  onNext: () => void
}) {
  const { org } = useVault()
  const session = org.session!
  const existing = new Set(vaults.map((v) => v.name.toLowerCase()))
  const [names, setNames] = useState<string[]>(() => (vaults.length ? [] : ['Infrastructure']))
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const has = (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase())
  const toggle = (n: string) => setNames((list) => (has(n) ? list.filter((x) => x.toLowerCase() !== n.toLowerCase()) : [...list, n]))
  const addCustom = () => {
    const n = custom.trim().slice(0, 100)
    if (!n) return
    if (!has(n) && !existing.has(n.toLowerCase())) setNames((l) => [...l, n])
    setCustom('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (custom.trim()) return addCustom()
    setBusy(true)
    try {
      for (const n of names) if (!existing.has(n.toLowerCase())) await createOrgVault(session, n, users)
      await reload()
      onNext()
    } catch (err) {
      setError(errText(err, 'Could not create the vault.'))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const toCreate = names.filter((n) => !existing.has(n.toLowerCase()))

  return (
    <form onSubmit={submit}>
      <StepHeading
        n={4}
        title="Create your first vaults"
        sub="A vault is a shared, encrypted collection of credentials: SSH keys, RDP hosts, VPN profiles and passwords. Access is granted per vault."
      />
      <div className="flex flex-col gap-5">
        <div>
          <p className={labelCls}>Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {VAULT_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase())).map((s) => {
              const on = has(s)
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition',
                    on ? 'border-border-brand bg-ember-a12 text-brand-secondary' : 'border-border-primary bg-primary text-secondary hover:border-border-brand',
                  )}
                >
                  {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {s}
                </button>
              )
            })}
          </div>
        </div>
        <Field id="vault-custom" label="Or name your own">
          <div className="flex gap-2">
            <input id="vault-custom" className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Customer VPNs" />
            <Button type="button" color="secondary" size="md" iconLeading={Plus} onClick={addCustom} isDisabled={!custom.trim()}>
              Add
            </Button>
          </div>
        </Field>

        {(vaults.length > 0 || toCreate.length > 0) && (
          <ul className="flex flex-col gap-2" aria-label="Vaults">
            {vaults.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-[12px] border border-border-secondary bg-secondary px-3.5 py-2.5">
                <Database01 className="size-4 text-fg-quaternary" />
                <span className="flex-1 text-sm font-medium text-primary">{v.name}</span>
                <span className="inline-flex items-center gap-1 text-xs text-success-primary">
                  <CheckCircle className="size-3.5" /> Created
                </span>
              </li>
            ))}
            {toCreate.map((n) => (
              <li key={n} className="flex items-center gap-3 rounded-[12px] border border-border-secondary bg-primary px-3.5 py-2.5">
                <Database01 className="size-4 text-fg-brand-primary" />
                <span className="flex-1 text-sm font-medium text-primary">{n}</span>
                <button type="button" onClick={() => toggle(n)} aria-label={`Remove ${n}`} className="text-fg-quaternary transition hover:text-primary">
                  <XClose className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Nav
        onBack={onBack}
        onSkip={vaults.length === 0 ? onNext : undefined}
        busy={busy}
        disabled={vaults.length === 0 && toCreate.length === 0}
        submitLabel={toCreate.length ? `Create ${toCreate.length === 1 ? 'vault' : `${toCreate.length} vaults`}` : 'Continue'}
      />
    </form>
  )
}

type Permission = 'none' | 'view' | 'edit'

function TeamStep({
  settings,
  vaults,
  onBack,
  onNext,
}: {
  settings: OrgSettings
  vaults: AdminVault[]
  onBack: () => void
  onNext: (summary: { invited: number; emailed: number }) => void
}) {
  const { org } = useVault()
  const session = org.session!
  const orgVaults = vaults.filter((v) => v.kind === 'org')
  const [text, setText] = useState('')
  const [role, setRole] = useState<OrgRole>('member')
  const [access, setAccess] = useState<Record<string, Permission>>(() => Object.fromEntries(orgVaults.map((v) => [v.id, 'edit'])))
  const [canExport, setCanExport] = useState(false)
  const [notify, setNotify] = useState(settings.mail !== 'unconfigured')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const parsed = useMemo(() => parseEmails(text), [text])
  const me = org.me?.email ?? ''
  const emails = parsed.valid.filter((e) => e !== me)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (parsed.invalid.length) return setError(`Not an email address: ${parsed.invalid.slice(0, 3).join(', ')}`)
    if (!emails.length) return onNext({ invited: 0, emailed: 0 })
    setBusy(true)
    try {
      const grants = orgVaults
        .filter((v) => access[v.id] !== 'none')
        .map((v) => ({ vaultId: v.id, canWrite: access[v.id] === 'edit', canExport }))
      const res = await invitePeople(
        session,
        emails.map((email) => ({ email, role })),
        grants,
        orgVaults.map((v) => v.id),
        notify,
      )
      if (res.failed.length) {
        setText(res.failed.map((f) => f.email).join('\n'))
        setError(res.failed.map((f) => `${f.email}: ${f.error}`).join(' · '))
        return
      }
      onNext({ invited: res.added.length, emailed: res.emailed })
    } catch (err) {
      setError(errText(err, 'Could not invite people.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <StepHeading n={5} title="Invite your team" sub="Add the people who need access. They choose their own password the first time they sign in." />
      <div className="flex flex-col gap-5">
        <Field
          id="invite-emails"
          label="Email addresses"
          hint={emails.length ? `${emails.length} ${emails.length === 1 ? 'person' : 'people'} to invite` : 'One per line, or separated by commas.'}
        >
          <textarea
            id="invite-emails"
            rows={4}
            className={`${inputCls} resize-y font-mono text-[13px]`}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError('')
            }}
            placeholder={'grace@acme.com\nlinus@acme.com'}
            spellCheck={false}
          />
        </Field>

        <Field id="invite-role" label="Role">
          <div id="invite-role" role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full border border-border-primary bg-secondary p-1">
            {(['member', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-[13px] font-semibold transition',
                  role === r ? 'bg-primary text-primary shadow-xs' : 'text-tertiary hover:text-primary',
                )}
              >
                {r === 'member' ? 'Member' : 'Admin'}
              </button>
            ))}
          </div>
        </Field>

        {role === 'admin' ? (
          <p className="rounded-[12px] border border-border-secondary bg-secondary p-3.5 text-[13px] leading-relaxed text-tertiary">
            Admins can open and edit every vault and manage people. A second admin is a good idea: it keeps the org
            manageable if you lose your password.
          </p>
        ) : orgVaults.length > 0 ? (
          <div>
            <p className={labelCls}>Vault access</p>
            <ul className="divide-y divide-border-secondary overflow-hidden rounded-[12px] border border-border-secondary">
              {orgVaults.map((v) => (
                <li key={v.id} className="flex items-center gap-3 bg-primary px-3.5 py-2.5">
                  <Database01 className="size-4 text-fg-quaternary" />
                  <span className="flex-1 truncate text-sm font-medium text-primary">{v.name}</span>
                  <select
                    aria-label={`Access to ${v.name}`}
                    className="rounded-[8px] border border-border-primary bg-primary px-2 py-1 text-[13px] text-primary outline-none focus:border-border-brand"
                    value={access[v.id] ?? 'edit'}
                    onChange={(e) => setAccess((a) => ({ ...a, [v.id]: e.target.value as Permission }))}
                  >
                    <option value="edit">Can edit</option>
                    <option value="view">View only</option>
                    <option value="none">No access</option>
                  </select>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center justify-between gap-3 text-[13px] text-secondary">
              <span>
                Allow downloading vault copies
                <span className="block text-xs text-tertiary">Off keeps secrets on the server; every download is logged.</span>
              </span>
              <Switch on={canExport} onChange={setCanExport} label="Allow downloading vault copies" />
            </label>
          </div>
        ) : (
          <p className="text-[13px] text-tertiary">No vaults yet: you can share vaults with them later from the admin console.</p>
        )}

        <label className="flex items-center justify-between gap-3 border-t border-secondary pt-4 text-[13px] text-secondary">
          <span>
            Email them sign-in instructions
            {settings.mail === 'unconfigured' && <span className="block text-xs text-error-primary">Email is not set up on this server yet.</span>}
          </span>
          <Switch on={notify} onChange={setNotify} label="Email them sign-in instructions" />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <Nav
        onBack={onBack}
        onSkip={() => onNext({ invited: 0, emailed: 0 })}
        busy={busy}
        submitLabel={emails.length ? `Invite ${emails.length === 1 ? '1 person' : `${emails.length} people`}` : 'Continue'}
      />
    </form>
  )
}

function DoneStep({
  orgName,
  vaults,
  summary,
  onFinish,
}: {
  orgName: string
  vaults: AdminVault[]
  summary: { invited: number; emailed: number }
  onFinish: () => Promise<void>
}) {
  const { org } = useVault()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const finish = async () => {
    setBusy(true)
    setError('')
    try {
      await onFinish()
    } catch (err) {
      setError(errText(err, 'Could not finish setup.'))
      setBusy(false)
    }
  }
  const rows = [
    { icon: Building07, label: 'Organization', value: orgName },
    { icon: ShieldTick, label: 'Admin', value: org.me?.email ?? '' },
    { icon: Database01, label: 'Vaults', value: vaults.length ? vaults.map((v) => v.name).join(', ') : 'None yet' },
    {
      icon: UserPlus01,
      label: 'Invited',
      value: summary.invited ? `${summary.invited} ${summary.invited === 1 ? 'person' : 'people'}${summary.emailed ? `, ${summary.emailed} emailed` : ''}` : 'Nobody yet',
    },
  ]
  return (
    <div>
      <span className="mb-6 grid size-14 place-items-center rounded-[16px] bg-ember-a16 text-fg-brand-primary">
        <CheckCircle className="size-7" />
      </span>
      <StepHeading title={`${orgName} is ready`} sub="Here's what you set up. You can change all of it in the admin console." />
      <dl className="divide-y divide-border-secondary overflow-hidden rounded-[14px] border border-border-secondary">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 bg-primary px-4 py-3">
            <r.icon className="size-4 shrink-0 text-fg-quaternary" />
            <dt className="w-28 shrink-0 text-[13px] text-tertiary">{r.label}</dt>
            <dd className="min-w-0 truncate text-sm font-medium text-primary">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold text-secondary">What happens next</h2>
        <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-tertiary">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" /> People you invited sign in with the RokoPW app using this server&apos;s address and choose a password.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" /> Their vault access shows as pending until then. The console finishes it automatically the next time you open it.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" /> Add credentials to a vault from the RokoPW vault app, signed in with this admin account.</li>
        </ul>
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-8 border-t border-secondary pt-6">
        <Button size="lg" className="w-full" iconTrailing={ArrowRight} onClick={() => void finish()} isLoading={busy} isDisabled={busy}>
          Open the admin console
        </Button>
      </div>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

/**
 * `status.state` decides where it starts: 'needs-admin' at step 1; 'in-progress'
 * (admin exists and is signed in) at step 3.
 */
export function SetupWizard({ serverUrl, status, onDone }: { serverUrl: string; status: SetupStatus; onDone: () => void }) {
  const { org } = useVault()
  const session = org.session
  const signedIn = !!session && !!org.privateKey && org.me?.role === 'admin'
  const [step, setStep] = useState<StepId>(status.state === 'needs-admin' ? 'org' : 'signin')
  const [orgDraft, setOrgDraft] = useState({ setupCode: '', orgName: status.orgName })
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [vaults, setVaults] = useState<AdminVault[]>([])
  const [summary, setSummary] = useState({ invited: 0, emailed: 0 })
  const [loadError, setLoadError] = useState('')

  const reload = async () => {
    if (!session) return
    const [s, u, v] = await Promise.all([api.admin.settings(session), api.admin.users(session), api.admin.vaults(session)])
    setSettings(s)
    setUsers(u)
    setVaults(v)
  }

  // Load org data once signed in (after step 2, or when resuming).
  useEffect(() => {
    if (!signedIn || step === 'org' || step === 'account') return
    let cancelled = false
    reload().catch((err) => !cancelled && setLoadError(errText(err, 'Could not load the server settings.')))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, session?.token, step === 'org' || step === 'account'])

  const orgName = settings?.orgName || orgDraft.orgName || status.orgName
  const needsData = step !== 'org' && step !== 'account'

  let body: ReactNode
  if (step === 'org') {
    body = (
      <OrgStep
        serverUrl={serverUrl}
        initial={orgDraft}
        onNext={(v) => {
          setOrgDraft(v)
          setStep('account')
        }}
      />
    )
  } else if (step === 'account') {
    body = <AccountStep serverUrl={serverUrl} org={orgDraft} onBack={() => setStep('org')} onNext={() => setStep('signin')} />
  } else if (loadError) {
    body = <ErrorNote>{loadError}</ErrorNote>
  } else if (needsData && !settings) {
    body = (
      <div className="grid place-items-center py-24" aria-label="Loading">
        <span className="size-8 animate-spin rounded-full border-2 border-border-primary border-t-brand-solid" />
      </div>
    )
  } else if (step === 'signin') {
    body = <SignInStep settings={settings!} setSettings={setSettings} onNext={() => setStep('vaults')} />
  } else if (step === 'vaults') {
    body = <VaultsStep vaults={vaults} users={users} reload={reload} onBack={() => setStep('signin')} onNext={() => setStep('team')} />
  } else if (step === 'team') {
    body = (
      <TeamStep
        settings={settings!}
        vaults={vaults}
        onBack={() => setStep('vaults')}
        onNext={(s) => {
          setSummary(s)
          setStep('done')
        }}
      />
    )
  } else {
    body = (
      <DoneStep
        orgName={orgName}
        vaults={vaults}
        summary={summary}
        onFinish={async () => {
          await api.admin.completeSetup(session!)
          onDone()
        }}
      />
    )
  }

  return (
    <WizardLayout step={step} serverUrl={serverUrl} orgName={orgName}>
      {body}
    </WizardLayout>
  )
}
