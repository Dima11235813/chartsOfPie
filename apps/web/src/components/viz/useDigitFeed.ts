import { useEffect, useRef } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import { createFrameBudget } from '../../viz/frameBudget'

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
 *
 * Drawing is spaced by its cost (`createFrameBudget`): a cheap view still draws every digit, but
 * one that redraws thousands of dots per digit (the mosaic's groups filter) batches several digits
 * into one redraw on a slow device, so it never crowds out note scheduling. A skipped batch is
 * drawn by a timer, so the newest digits always appear, playing or paused.
 */
/** Batches of more digits than this are replays, not live playback. */
const BULK = 200

export function useDigitFeed(log: PerformanceLog, redrawKey: string, handlers: DigitFeedHandlers) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    let drawn = 0
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const budget = createFrameBudget({ share: 0.3 })
    const flush = () => {
      frame = 0
      const total = log.stepCount
      if (total < drawn) {
        handlersRef.current.reset()
        drawn = 0
      }
      if (total <= drawn) return
      const now = performance.now()
      if (!budget.due(now)) {
        // Too soon after an expensive draw: catch up a little later (also when paused).
        timer ??= setTimeout(() => {
          timer = undefined
          if (!frame) frame = requestAnimationFrame(flush)
        }, 40)
        return
      }
      // A bulk replay (resuming a piece far in) is one-off work, not a normal frame's cost.
      budget.run(now, () => handlersRef.current.draw(drawn, total), total - drawn < BULK)
      drawn = total
    }
    handlersRef.current.reset()
    flush()
    const unsubscribe = log.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(flush)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [log, redrawKey])
}
