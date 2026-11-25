/**
 * Roko brand mark + "RokoPW" wordmark.
 *
 * The mark is the roko.dev logo: a rounded square with an "r" stroke and the
 * ember "cursor" square. `tone` picks colours for the surface it sits on:
 *  - "auto"   follows the current theme (ink square on light, paper on dark)
 *  - "onDark" always the reversed mark (paper square), for ink panels
 */
export function RokoMark({
  size = 28,
  tone = 'auto',
  className,
}: {
  size?: number
  tone?: 'auto' | 'onDark'
  className?: string
}) {
  const square = tone === 'onDark' ? 'var(--paper)' : 'var(--color-text-primary)'
  const stroke = tone === 'onDark' ? 'var(--ink-900)' : 'var(--color-bg-primary)'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Roko"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="16" fill={square} />
      <path
        d="M20 43V33a12 12 0 0 1 12-12h2"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        stroke={stroke}
      />
      <rect x="39" y="37" width="10" height="10" rx="1.5" fill="var(--ember-500)" />
    </svg>
  )
}

export function RokoLogo({
  size = 28,
  tone = 'auto',
  showWordmark = true,
}: {
  size?: number
  tone?: 'auto' | 'onDark'
  showWordmark?: boolean
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <RokoMark size={size} tone={tone} />
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: size * 0.68,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            color: tone === 'onDark' ? 'var(--paper)' : 'var(--color-text-primary)',
          }}
        >
          Roko
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              fontSize: '0.62em',
              letterSpacing: '0.04em',
              marginInlineStart: '0.3em',
              verticalAlign: '0.18em',
              color: 'var(--ember-500)',
            }}
          >
            PW
          </span>
        </span>
      )}
    </span>
  )
}
