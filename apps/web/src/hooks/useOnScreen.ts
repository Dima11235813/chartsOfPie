import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Whether an element is actually on screen: at least partly inside the viewport (not scrolled
 * away, not under a full-screen stage) and in a visible tab. Expensive views use it to stop
 * computing what nobody can see. Without IntersectionObserver (old browsers, jsdom) it only
 * follows the tab's visibility.
 */
export function useOnScreen<T extends Element>(): [(element: T | null) => void, boolean] {
  const [element, setElement] = useState<T | null>(null)
  const [intersecting, setIntersecting] = useState(true)
  const [page, setPage] = useState(readPage)
  const last = useRef<T | null>(null)
  const ref = useCallback((next: T | null) => {
    if (next === last.current) return
    last.current = next
    setElement(next)
  }, [])

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1)
      if (entry) setIntersecting(entry.isIntersecting)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  // Tab switches and full screen (which covers everything but the full-screen element, though the
  // rest still "intersects" the viewport) re-check visibility.
  useEffect(() => {
    const update = () => setPage(readPage())
    document.addEventListener('visibilitychange', update)
    document.addEventListener('fullscreenchange', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      document.removeEventListener('fullscreenchange', update)
    }
  }, [])

  const covered = Boolean(page.fullscreen && element && !page.fullscreen.contains(element))
  return [ref, intersecting && !page.hidden && !covered]
}

function readPage(): { hidden: boolean; fullscreen: Element | null } {
  if (typeof document === 'undefined') return { hidden: false, fullscreen: null }
  return {
    hidden: document.visibilityState === 'hidden',
    fullscreen: document.fullscreenElement ?? null,
  }
}
