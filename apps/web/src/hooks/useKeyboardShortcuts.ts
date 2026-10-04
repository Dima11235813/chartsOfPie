import { useEffect, useRef } from 'react'

export interface ShortcutHandlers {
  /** Space: play / pause. */
  toggle(): void
  /** → : play one digit. */
  step(): void
  /** M: mute / unmute. */
  mute(): void
}

/** Elements that already use these keys themselves (Space presses a focused button, etc.). */
const OWN_KEYS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'OUTPUT'])

export function isShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true
  return !OWN_KEYS.has(target.tagName) && !target.isContentEditable
}

/**
 * Global keyboard shortcuts (F09.2). Ignored while typing in a field, on a focused control that
 * handles the key itself, or with a modifier held. A key press counts as a user gesture, so Space
 * may start audio.
 */
export function useKeyboardShortcuts(enabled: boolean, handlers: ShortcutHandlers) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
      if (!isShortcutTarget(event.target)) return
      const action =
        event.key === ' '
          ? latest.current.toggle
          : event.key === 'ArrowRight'
            ? latest.current.step
            : event.key === 'm' || event.key === 'M'
              ? latest.current.mute
              : null
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
