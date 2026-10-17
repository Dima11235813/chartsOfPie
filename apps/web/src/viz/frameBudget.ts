/**
 * Frame budget for continuously animated views (R-010 third pass). Notes are scheduled from the
 * main thread, so a view that draws for too long, too often, makes the rhythm stumble on a slow
 * device. A view asks `due(now)` before drawing and wraps the drawing in `run`: frames are spaced
 * so that drawing takes at most `share` of the time (a 20 ms draw at share 0.3 → one every 67 ms),
 * never more often than `minIntervalMs` and at least every `maxIntervalMs`. On a fast machine the
 * cost is tiny and nothing changes; on a slow one the animation gets choppier instead of the sound.
 *
 * `watchFrames` (for views that call `due` on every animation frame): the time `run` measures is
 * only the JavaScript; the browser rasterises canvas paths later, outside it (a long gradient
 * curve costs far more there). So the gaps between animation frames are watched too: a gap over
 * 50 ms means the page is overloaded, and frames are spaced at least that far apart until the gaps
 * shrink again.
 */
export interface FrameBudget {
  /** True when enough time has passed since the last drawn frame. */
  due(now: number): boolean
  /**
   * Draw now (call when `due`), measuring how long it takes. `measure: false` for one-off bulk
   * work (replaying thousands of digits after a seek) that says nothing about a normal frame.
   */
  run(now: number, draw: () => void, measure?: boolean): void
  /** Smoothed cost of one draw, in ms. */
  readonly cost: number
}

/** A gap between animation frames longer than this means the main thread is overloaded. */
const OVERLOADED_FRAME_MS = 50

export function createFrameBudget({
  minIntervalMs = 0,
  maxIntervalMs = 500,
  share = 0.3,
  watchFrames = false,
  clock = () => performance.now(),
}: {
  minIntervalMs?: number
  maxIntervalMs?: number
  share?: number
  watchFrames?: boolean
  clock?: () => number
} = {}): FrameBudget {
  let cost = 0
  let last = -Infinity
  /** Extra spacing learned from overloaded frames (decays while frames come on time). */
  let backoff = 0
  let previousFrame = -Infinity
  return {
    due(now) {
      if (watchFrames) {
        const gap = now - previousFrame
        previousFrame = now
        // Over 1 s is a hidden tab or a pause, not load.
        if (gap > OVERLOADED_FRAME_MS && gap < 1000) backoff = Math.max(backoff * 1.5, gap)
        else backoff *= 0.95
        backoff = Math.min(backoff, maxIntervalMs)
      }
      const interval = Math.min(maxIntervalMs, Math.max(minIntervalMs, cost / share, backoff * 4))
      return now - last >= interval
    },
    run(now, draw, measure = true) {
      last = now
      const start = clock()
      draw()
      if (!measure) return
      const took = clock() - start
      // Exponential average: one slow frame (GC) does not halve the frame rate for long.
      cost = cost === 0 ? took : cost * 0.8 + took * 0.2
    },
    get cost() {
      return cost
    },
  }
}
