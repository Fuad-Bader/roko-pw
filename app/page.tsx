import Link from 'next/link'
import { InstallButton } from './components/InstallButton'

function Brand() {
  return (
    <>
      Roko<span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">PW</span>
    </>
  )
}

// ─── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🛡️',
    title: 'Zero Trust',
    body: 'Your master password never leaves your browser. We derive a key with PBKDF2 (600k rounds) and encrypt everything with AES-256-GCM before touching the network.',
  },
  {
    icon: '🧩',
    title: 'Smart Autofill',
    body: 'The browser extension detects login forms automatically. A single click fills your username and password — even on React and Vue apps.',
  },
  {
    icon: '☁️',
    title: 'Flexible Storage',
    body: 'Keep your vault local in IndexedDB, or sync an encrypted blob to the remote server and access it from any device using your Vault ID.',
  },
  {
    icon: '🔑',
    title: 'Password Generator',
    body: 'Generate cryptographically random passwords up to 64 characters with a built-in strength meter. Guarantee uppercase, digits and symbols.',
  },
]

// ─── How-it-works steps ────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Create your vault',
    body: <>Choose a strong master password. <Brand /> derives your encryption key locally — nothing is sent to the server during setup.</>,
  },
  {
    n: '02',
    title: 'Add credentials',
    body: 'Save usernames, passwords, and notes. Every entry is encrypted before being written to storage.',
  },
  {
    n: '03',
    title: 'Autofill anywhere',
    body: <>Install the browser extension. When you visit a login page, <Brand /> detects the form and fills it instantly.</>,
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Nav ── */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-base">🔐</span>
          <span className="text-lg font-bold tracking-tight"><Brand /></span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com"
            className="hidden text-sm text-zinc-400 transition hover:text-white sm:block"
          >
            GitHub
          </Link>
          <Link
            href="/vault"
            className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Open vault →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-16 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
          <span className="size-1.5 rounded-full bg-indigo-400" />
          AES-256-GCM · PBKDF2 · Zero trust
        </div>

        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl">
          Passwords only{' '}
          <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            you
          </span>{' '}
          can read.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
          <Brand /> encrypts everything in your browser before it ever reaches a server.
          Your master password is never stored, never transmitted — it exists only in your head.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <InstallButton size="lg" />
          <Link
            href="/vault"
            className="flex items-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Open web app
            <span className="text-zinc-500">→</span>
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-600">
          Free and open source · No account required · Works offline
        </p>
      </section>

      {/* ── Encryption preview ── */}
      <section className="border-y border-zinc-800 bg-zinc-900/50 py-12">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
            What the server actually stores
          </p>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 font-mono text-xs">
            <div className="mb-3 flex gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500/60" />
              <span className="size-2.5 rounded-full bg-yellow-500/60" />
              <span className="size-2.5 rounded-full bg-green-500/60" />
            </div>
            <pre className="overflow-x-auto text-zinc-500">
{`{
  "version": 1,
  "salt": "4zK1mNqW8vR3xLpJ6oFdYbEcAhStGuIn",
  "iv":   "mK9pQ2wX",
  "ciphertext": `}<span className="text-indigo-400">{`"Ua3fR8kLpW2nVx..."`}</span>{`
}`}
            </pre>
            <p className="mt-3 text-zinc-600">
              ↑ Meaningless without your master password. Even we can&apos;t decrypt this.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="mb-2 text-center text-sm font-medium text-indigo-400">Features</p>
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          Built for privacy. Designed for speed.
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-700"
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-zinc-800 bg-zinc-900/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-2 text-center text-sm font-medium text-indigo-400">How it works</p>
          <h2 className="mb-14 text-center text-3xl font-bold tracking-tight">
            Up and running in three steps.
          </h2>

          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* Connector line */}
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-linear-to-r from-transparent via-zinc-700 to-transparent sm:block" />

            {STEPS.map((s) => (
              <div key={s.n} className="relative flex flex-col gap-4">
                <div className="flex size-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-sm font-bold text-indigo-400">
                  {s.n}
                </div>
                <div>
                  <h3 className="mb-1.5 font-semibold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security callout ── */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="rounded-3xl border border-indigo-500/20 bg-linear-to-br from-indigo-950/60 via-zinc-900 to-violet-950/40 p-10 text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="mb-3 text-2xl font-bold">Your passwords, fully under your control.</h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-400">
            <Brand /> uses the browser&apos;s built-in{' '}
            <span className="text-white">Web Crypto API</span> — no third-party crypto libraries.
            The source code is open for inspection. Trust the math, not us.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <InstallButton size="lg" />
            <Link
              href="/vault"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Try web app
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded bg-indigo-600 text-xs">🔐</span>
            <span className="text-sm font-semibold text-white"><Brand /></span>
            <span className="text-xs text-zinc-600">— Zero-trust password manager</span>
          </div>
          <p className="text-xs text-zinc-600">
            Encrypted with AES-256-GCM · PBKDF2-SHA256 · Web Crypto API
          </p>
        </div>
      </footer>

    </div>
  )
}
