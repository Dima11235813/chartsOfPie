import { useEffect, useRef, useState } from 'react'

/**
 * `value`, updated at most once every `ms` (the latest value always lands, at the end of the
 * window). For expensive derived views of fast-changing data — e.g. a census per digit at 13
 * digits/s — so they recompute a few times a second instead of on every change.
 */
export function useThrottled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    const wait = Math.max(0, last.current + ms - performance.now())
    const timer = setTimeout(() => {
      last.current = performance.now()
      setShown(value)
    }, wait)
    return () => clearTimeout(timer)
  }, [value, ms])
  return shown
}
