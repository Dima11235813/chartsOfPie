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

/** Least headroom a step keeps on the audio clock; a grid time closer than this is re-anchored. */
export const MIN_HEADROOM_SEC = 0.01
/** A grid time further than this ahead of "now" (the engine running early) is re-anchored. */
export const MAX_AHEAD_SEC = 0.08

/**
 * Audio time of the next step. Steps follow the ideal grid (the last step plus the gap the engine
 * asked for) so rhythm survives a busy main thread: the engine catches up its late ticks, and as
 * long as the grid time is still ahead of the audio clock the note plays exactly on it. Only when
 * that time has (nearly) passed, or the grid ran far ahead, does the rhythm re-anchor to `now`.
 *
 * `now` is the scheduling time (audio clock + look-ahead), `audioNow` the audio clock itself.
 * With a 150 ms look-ahead this absorbs main-thread stalls up to ~140 ms; it used to re-anchor
 * (an audible stumble) after 80 ms (R-010 third pass).
 */
export function nextStepTime(
  lastTime: number | null,
  gapSec: number,
  now: number,
  audioNow: number,
): { time: number; reanchored: boolean } {
  if (lastTime === null) return { time: now, reanchored: false }
  let time = lastTime + gapSec
  let reanchored = false
  if (time < audioNow + MIN_HEADROOM_SEC || time - now > MAX_AHEAD_SEC) {
    time = now
    reanchored = true
  }
  // Two attacks at the same audio time are rejected by Tone; keep them strictly increasing.
  if (time <= lastTime) time = lastTime + 0.001
  return { time, reanchored }
}
