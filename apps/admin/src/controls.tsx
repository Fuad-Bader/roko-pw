/** Small controls shared by the admin console and the setup wizard. */
import { useState, type ReactNode } from 'react'
import { Button } from '@roko/ui/components/base/buttons/button'
import { cx } from '@roko/ui/utils/cx'
import { AlertTriangle, CheckCircle, Globe01, Mail01, Send01, ShieldTick, Terminal } from '@untitledui/icons'
import type { MailMode } from '@roko/vault-core/lib/orgApi'

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-error-primary px-3.5 py-2.5 text-[13px] text-error-primary">
      <AlertTriangle className="mt-px size-4 shrink-0" /> <span>{children}</span>
    </p>
  )
}

const errText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

/** On/off switch (button with role=switch). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-brand-solid dark:bg-ember-a72' : 'bg-quaternary'}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow-xs transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function MailStatus({ mail, email, onTest }: { mail: MailMode; email: string; onTest: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const test = async () => {
    setState('sending')
    setError('')
    try {
      await onTest()
      setState('sent')
    } catch (err) {
      setError(errText(err, 'Could not send the test email.'))
      setState('error')
    }
  }
  const info = {
    smtp: {
      icon: Mail01,
      tone: 'ok',
      title: 'Email is set up',
      text: 'Sign-in codes and invitations are sent through your SMTP server. Send yourself a test to be sure.',
    },
    log: {
      icon: Terminal,
      tone: 'warn',
      title: 'Development mode: emails go to the server log',
      text: 'MAIL_LOG=true prints every email, including sign-in codes, to the server console. Fine for trying RokoPW out; set SMTP_* and turn it off before real use.',
    },
    unconfigured: {
      icon: AlertTriangle,
      tone: 'error',
      title: 'Email is not set up',
      text: 'Everyone, including you, needs an emailed code to sign in. Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in the server .env and restart it.',
    },
  }[mail]
  const toneCls = {
    ok: 'bg-success-primary text-fg-success-primary',
    warn: 'bg-warning-primary text-fg-warning-primary',
    error: 'bg-error-primary text-fg-error-primary',
  }[info.tone]
  return (
    <div className="rounded-[14px] border border-border-secondary bg-primary p-4">
      <div className="flex gap-3">
        <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', toneCls)}>
          <info.icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">{info.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-tertiary">{info.text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" color="secondary" iconLeading={Send01} onClick={() => void test()} isLoading={state === 'sending'} isDisabled={state === 'sending'}>
              Send a test to {email}
            </Button>
            {state === 'sent' && (
              <span className="inline-flex items-center gap-1 text-[13px] text-success-primary">
                <CheckCircle className="size-4" /> {mail === 'log' ? 'Sent: check the server log' : 'Sent: check your inbox'}
              </span>
            )}
          </div>
          {state === 'error' && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        </div>
      </div>
    </div>
  )
}

export function SignupPolicy({ allowSignups, locked, onChange }: { allowSignups: boolean; locked: boolean; onChange: (v: boolean) => void }) {
  const options = [
    { value: false, icon: ShieldTick, title: 'Invite only', tag: 'Recommended', text: 'Only people an admin adds can sign in.' },
    { value: true, icon: Globe01, title: 'Open sign-up', text: 'Anyone who can reach this server can create an account. They see no vaults until an admin shares one.' },
  ]
  return (
    <div role="radiogroup" aria-label="Who can create an account" className="grid gap-2.5">
      {options.map((o) => {
        const selected = allowSignups === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex w-full gap-3 rounded-[14px] border p-4 text-left transition disabled:cursor-not-allowed',
              selected ? 'border-border-brand bg-ember-a04 shadow-[0_0_0_3px_var(--ember-a12)]' : 'border-border-secondary bg-primary hover:border-border-primary',
              locked && !selected && 'opacity-50',
            )}
          >
            <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', selected ? 'bg-ember-a16 text-fg-brand-primary' : 'bg-secondary text-fg-quaternary')}>
              <o.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                {o.title}
                {o.tag && <span className="roko-tag">{o.tag}</span>}
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-tertiary">{o.text}</span>
            </span>
            <span
              aria-hidden
              className={cx('mt-1 grid size-[18px] shrink-0 place-items-center rounded-full border', selected ? 'border-[var(--ember-500)] bg-[var(--ember-500)]' : 'border-border-primary')}
            >
              {selected && <span className="size-1.5 rounded-full bg-white" />}
            </span>
          </button>
        )
      })}
      {locked && <p className="text-xs text-tertiary">Set by ALLOW_SIGNUPS on the server. Remove it from the .env to choose here.</p>}
    </div>
  )
}

