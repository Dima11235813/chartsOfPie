import { useEffect, useRef } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'

export interface DigitFeedHandlers {
  /** Start over: clear everything drawn so far. */
  reset(): void
  /** Draw digits for steps [from, to) (step i is digit i of the source since the last Reset). */
  draw(from: number, to: number): void
}

/**
 * Drives a growing visualization from the performance log: new digits are drawn once per animation
 * frame (so bursts of fast digits are batched), and the picture is rebuilt from scratch whenever
 * `redrawKey` changes (size, palette…) or playback is reset.
 */
export function useDigitFeed(log: PerformanceLog, redrawKey: string, handlers: DigitFeedHandlers) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    let drawn = 0
    let frame = 0
    const flush = () => {
      frame = 0
      const total = log.stepCount
      if (total < drawn) {
        handlersRef.current.reset()
        drawn = 0
      }
      if (total > drawn) {
        handlersRef.current.draw(drawn, total)
        drawn = total
      }
    }
    handlersRef.current.reset()
    flush()
    const unsubscribe = log.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(flush)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [log, redrawKey])
}

/** An offscreen canvas the same size as `canvas`, used to accumulate drawing between frames. */
export function createLayer(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const layer = document.createElement('canvas')
  layer.width = canvas.width
  layer.height = canvas.height
  return layer
}
