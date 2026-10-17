/**
 * Note timing health (R-010 third pass). Notes are scheduled from the main thread a little ahead
 * of the audio clock (`LOOK_AHEAD_SEC`); a busy main thread eats that headroom. These counters say
 * whether it ever ran out — what you would hear as a late or stumbling note — and are read by the
 * performance harness (`npm run perf`) and by agents through the Chrome DevTools MCP server
 * (`window.chartsOfPieAudioTiming()`).
 */
export interface AudioTiming {
  /** Steps scheduled (notes and rests). */
  readonly steps: number
  /** Steps scheduled after their audio time had already passed: they sounded late. */
  readonly late: number
  /** Times the rhythm was re-anchored because the main thread fell too far behind. */
  readonly reanchors: number
  /** Least headroom seen, in ms (scheduled time minus the audio clock); Infinity before any. */
  readonly minHeadroomMs: number
}

export interface TimingStats {
  /** One step scheduled `headroomSec` ahead of the audio clock (negative = late). */
  record(headroomSec: number, reanchored: boolean): void
  snapshot(): AudioTiming
}

export function createTimingStats(): TimingStats {
  let steps = 0
  let late = 0
  let reanchors = 0
  let minHeadroomMs = Infinity
  return {
    record(headroomSec, reanchored) {
      steps++
      if (headroomSec < 0) late++
      if (reanchored) reanchors++
      minHeadroomMs = Math.min(minHeadroomMs, headroomSec * 1000)
    },
    snapshot: () => ({ steps, late, reanchors, minHeadroomMs }),
  }
}
