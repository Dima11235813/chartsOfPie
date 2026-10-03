import { useEffect, useRef, useState, type RefCallback } from 'react'

export interface CanvasSize {
  width: number
  height: number
  /** devicePixelRatio used for the backing store. */
  ratio: number
}

/**
 * Keeps a canvas's backing store matched to its CSS size × devicePixelRatio and reports the size.
 * `onCanvas` lets the parent know which canvas is on screen (for video recording).
 */
export function useCanvas(onCanvas?: (canvas: HTMLCanvasElement | null) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, ratio: 1 })
  const onCanvasRef = useRef(onCanvas)

  useEffect(() => {
    onCanvasRef.current = onCanvas
  })

  const ref: RefCallback<HTMLCanvasElement> = (canvas) => {
    canvasRef.current = canvas
    onCanvasRef.current?.(canvas)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let measured = false
    const update = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(canvas.clientWidth))
      const height = Math.max(1, Math.round(canvas.clientHeight))
      const backingWidth = Math.round(width * ratio)
      const backingHeight = Math.round(height * ratio)
      // Assigning canvas.width clears the canvas, even to the same value (ResizeObserver reports
      // the initial size too), so only touch it — and re-render — when the size really changed.
      if (measured && canvas.width === backingWidth && canvas.height === backingHeight) return
      measured = true
      if (canvas.width !== backingWidth) canvas.width = backingWidth
      if (canvas.height !== backingHeight) canvas.height = backingHeight
      setSize({ width, height, ratio })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => onCanvasRef.current?.(null), [])

  return { ref, canvasRef, size }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
