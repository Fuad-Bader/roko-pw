import { useEffect, useState } from 'react'

const api = () => (window as any).electronAPI?.window

function MinimizeIcon() {
  return (
    <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
      <path d="M0 0.5H10" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="0.625" y="0.625" width="8.75" height="8.75" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="2.625" y="0.625" width="6.75" height="6.75" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <path d="M0.625 3.125V8.875C0.625 9.289 0.961 9.625 1.375 9.625H7.125" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const isMac = navigator.userAgent.includes('Macintosh')

  useEffect(() => {
    if (isMac) return
    api()?.isMaximized().then(setIsMaximized)
  }, [isMac])

  if (isMac) return null

  const btnCls =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-quaternary transition-colors duration-100 hover:bg-secondary_hover hover:text-secondary [-webkit-app-region:no-drag]'

  return (
    <div
      className="flex h-10 w-full shrink-0 select-none items-center justify-between bg-secondary pl-4 pr-1 [-webkit-app-region:drag]"
    >
      {/* App name */}
      <span className="text-xs font-semibold tracking-wide text-quaternary">
        Roko<span className="text-brand-400">PW</span>
      </span>

      {/* Window controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Minimize"
          className={btnCls}
          onClick={() => api()?.minimize()}
        >
          <MinimizeIcon />
        </button>

        <button
          type="button"
          title={isMaximized ? 'Restore' : 'Maximize'}
          className={btnCls}
          onClick={() => api()?.maximize().then(() => setIsMaximized((v) => !v))}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        <button
          type="button"
          title="Close"
          className={`${btnCls} hover:!bg-red-500/20 hover:!text-red-400`}
          onClick={() => api()?.close()}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
