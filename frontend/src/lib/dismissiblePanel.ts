'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Must match the duration in the slide-out class below, since the parent unmounts
// the panel on this timer and would cut the animation short if it were shorter.
const CLOSE_ANIMATION_MS = 200

// Radix renders popovers, dropdowns and dialogs into portals at the end of the body,
// so a click inside a panel's own date picker or review dialog lands outside the panel
// element and would otherwise read as a click-away.
const PORTAL_SELECTOR = [
  '[data-radix-popper-content-wrapper]',
  '[data-slot="popover-content"]',
  '[data-slot="dialog-content"]',
  '[data-slot="dialog-overlay"]',
].join(',')

export function panelSlideClass(closing: boolean): string {
  return closing
    ? 'animate-out slide-out-to-right fill-mode-forwards duration-200 pointer-events-none'
    : 'animate-in slide-in-from-right duration-200'
}

/**
 * Right-hand side panel dismissal: click anywhere outside, Escape, or Cmd/Ctrl+Enter.
 *
 * Callers unmount the panel when `onClose` fires, so the slide-out is played first and
 * `onClose` is deferred until it finishes. `onBeforeClose` runs synchronously at the
 * start of that sequence, which is where a panel flushes anything still unsaved.
 */
export function useDismissiblePanel<T extends HTMLElement>(
  onClose: () => void,
  onBeforeClose?: () => void,
) {
  const panelRef = useRef<T>(null)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const onBeforeCloseRef = useRef(onBeforeClose)
  onBeforeCloseRef.current = onBeforeClose

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    onBeforeCloseRef.current?.()
    setClosing(true)
    timerRef.current = setTimeout(onClose, CLOSE_ANIMATION_MS)
  }, [onClose])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A date picker or dialog opened from inside the panel takes the keystroke
      // first, so backing out of one of those doesn't also dismiss the panel.
      if (document.querySelector(PORTAL_SELECTOR)) return
      if (e.key === 'Escape') requestClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        requestClose()
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || panelRef.current?.contains(target)) return
      if (target.closest(PORTAL_SELECTOR)) return
      requestClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [requestClose])

  return { panelRef, closing, requestClose }
}
