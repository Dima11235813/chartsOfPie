/**
 * Frame budget for continuously animated views (R-010 third pass). Notes are scheduled from the
 * main thread, so a view that draws for too long, too often, makes the rhythm stumble on a slow
 * device. A view asks `due(now)` before drawing and wraps the drawing in `run`: frames are spaced
 * so that drawing takes at most `share` of the time (a 20 ms draw at share 0.3 → one every 67 ms),
 * never more often than `minIntervalMs` and at least every `maxIntervalMs`. On a fast machine the
 * cost is tiny and nothing changes; on a slow one the animation gets choppier instead of the sound.
 */
export interface FrameBudget {
  /** True when enough time has passed since the last drawn frame. */
  due(now: number): boolean
  /** Draw now (call when `due`), measuring how long it takes. */
  run(now: number, draw: () => void): void
  /** Smoothed cost of one draw, in ms. */
  readonly cost: number
}

export function createFrameBudget({
  minIntervalMs = 0,
  maxIntervalMs = 500,
  share = 0.3,
  clock = () => performance.now(),
}: {
  minIntervalMs?: number
  maxIntervalMs?: number
  share?: number
  clock?: () => number
} = {}): FrameBudget {
  let cost = 0
  let last = -Infinity
  return {
    due(now) {
      const interval = Math.min(maxIntervalMs, Math.max(minIntervalMs, cost / share))
      return now - last >= interval
    },
    run(now, draw) {
      last = now
      const start = clock()
      draw()
      const took = clock() - start
      // Exponential average: one slow frame (GC) does not halve the frame rate for long.
      cost = cost === 0 ? took : cost * 0.8 + took * 0.2
    },
    get cost() {
      return cost
    },
  }
}
