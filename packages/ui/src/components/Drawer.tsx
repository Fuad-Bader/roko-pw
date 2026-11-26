'use client'

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { XClose } from '@untitledui/icons'
import { ResizeHandle } from './ResizeHandle'

/**
 * A panel that slides in from the right over the page, with a dimmed backdrop.
 * Closes on Escape, backdrop click or the close button; keeps keyboard focus
 * inside while open and returns it to where it was on close. Resizable from its
 * left edge when `resize` is given.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
  width = 520,
  resize,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
  resize?: { min: number; max: number; onResize: (w: number) => void; onReset: () => void }
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Latest onClose for the key handler, without re-running the focus effect.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  // Remember what had focus before opening (content may autofocus before our
  // effect runs, so track it while closed) to restore it on close.
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) return
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      // Autofocus inside the drawer fires before this listener is removed: ignore it.
      if (target.closest?.('[data-roko-drawer]')) return
      returnFocus.current = target
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])

  // Focus handling + Escape. Runs once per opening.
  useEffect(() => {
    if (!open) return
    const previous = returnFocus.current
    const panel = panelRef.current
    // Let autoFocus inside the content win; otherwise focus the panel itself.
    const t = window.setTimeout(() => {
      if (panel && !panel.contains(document.activeElement)) panel.focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden
        onClick={onClose}
        className="roko-backdrop-in absolute inset-0 bg-[rgb(10_13_18/0.42)] dark:bg-[rgb(0_0_0/0.55)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-roko-drawer
        aria-labelledby={titleId}
        tabIndex={-1}
        className="roko-drawer-in absolute inset-y-0 right-0 flex max-w-full flex-col border-l border-secondary bg-primary shadow-2xl outline-none"
        style={{ width }}
      >
        {resize && (
          <ResizeHandle
            edge="left"
            label="Resize panel"
            width={width}
            min={resize.min}
            max={resize.max}
            onResize={resize.onResize}
            onReset={resize.onReset}
          />
        )}
        <div className="flex items-center justify-between gap-3 border-b border-secondary px-5 py-3.5">
          <h2 id={titleId} className="m-0 text-[15px] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="grid size-8 place-items-center rounded-full border border-primary bg-secondary text-tertiary transition hover:text-primary"
          >
            <XClose className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
