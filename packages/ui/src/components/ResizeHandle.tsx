'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface WidthLimits {
  initial: number
  min: number
  max: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * A panel width that the user can change and that is remembered per browser.
 * `max` may be lowered at runtime (e.g. to keep room for other panels).
 */
export function useResizableWidth(storageKey: string, { initial, min, max }: WidthLimits) {
  const [width, setWidthState] = useState(initial)

  // Restore after mount (localStorage isn't available during server rendering).
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey))
      if (saved) setWidthState(clamp(saved, min, max))
    } catch {
      /* storage unavailable: keep the default */
    }
    // Only on first mount; limits changing later must not reset the user's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const setWidth = useCallback(
    (next: number) => {
      const w = Math.round(clamp(next, min, max))
      setWidthState(w)
      try {
        localStorage.setItem(storageKey, String(w))
      } catch {
        /* ignore */
      }
    },
    [storageKey, min, max],
  )

  const reset = useCallback(() => {
    setWidthState(initial)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }, [storageKey, initial])

  return { width: clamp(width, min, max), setWidth, reset, min, max }
}

/**
 * Vertical drag handle on the right (default) or left edge of a panel (the panel
 * must be `position: relative`). Drag with mouse/touch, or focus it and use the
 * arrow keys (Shift for bigger steps, Home/End for min/max). Double-click resets.
 * On a left edge (e.g. a drawer that opens from the right) dragging left grows it.
 */
export function ResizeHandle({
  label,
  width,
  min,
  max,
  onResize,
  onReset,
  edge = 'right',
}: {
  edge?: 'right' | 'left'
  label: string
  width: number
  min: number
  max: number
  onResize: (width: number) => void
  onReset: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; width: number } | null>(null)
  const dir = edge === 'left' ? -1 : 1

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, width }
    setDragging(true)
    // Keep the resize cursor and stop text selection while dragging anywhere.
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    onResize(start.current.width + dir * (e.clientX - start.current.x))
  }
  const stop = () => {
    start.current = null
    setDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16
    if (e.key === 'ArrowLeft') onResize(width - dir * step)
    else if (e.key === 'ArrowRight') onResize(width + dir * step)
    else if (e.key === 'Home') onResize(min)
    else if (e.key === 'End') onResize(max)
    else if (e.key === 'Enter') onReset()
    else return
    e.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}: drag to resize, double-click to reset`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      data-dragging={dragging || undefined}
      className={`group absolute inset-y-0 z-20 flex w-[9px] cursor-col-resize touch-none justify-center outline-none ${
        edge === 'left' ? '-left-[4px]' : '-right-[4px]'
      }`}
    >
      <span
        aria-hidden
        className="h-full w-[2px] rounded-full bg-transparent transition-colors duration-150 group-hover:bg-ember-a40 group-focus-visible:bg-ember-a72 group-data-[dragging]:bg-ember-a72"
      />
    </div>
  )
}
