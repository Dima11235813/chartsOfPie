import { describe, expect, it } from 'vitest'
import { createTimingStats, nextStepTime } from './timingStats'

describe('note timing stats', () => {
  it('counts late steps (negative headroom), re-anchors and the least headroom', () => {
    const stats = createTimingStats()
    expect(stats.snapshot()).toEqual({ steps: 0, late: 0, reanchors: 0, minHeadroomMs: Infinity })
    stats.record(0.15, false)
    stats.record(0.02, false)
    stats.record(-0.01, true)
    const { steps, late, reanchors, minHeadroomMs } = stats.snapshot()
    expect([steps, late, reanchors]).toEqual([3, 1, 1])
    expect(minHeadroomMs).toBeCloseTo(-10)
  })
})

describe('next step time', () => {
  // Audio clock at 10 s, look-ahead 150 ms: "now" for scheduling is 10.15 s.
  const audioNow = 10
  const now = 10.15

  it('the first step plays at now', () => {
    expect(nextStepTime(null, 0.075, now, audioNow)).toEqual({ time: now, reanchored: false })
  })

  it('keeps the grid when the tick is on time', () => {
    const { time, reanchored } = nextStepTime(10.075, 0.075, now, audioNow)
    expect(time).toBeCloseTo(10.15)
    expect(reanchored).toBe(false)
  })

  it('keeps the grid through a 120 ms stall: the note is still ahead of the audio clock', () => {
    // The grid time is 9.955 + 0.075 = 10.03: the tick fired 120 ms late (now − 0.12), yet the
    // note is still 30 ms ahead of the audio clock, so it plays exactly on the grid. (The old
    // rule re-anchored any tick more than 80 ms late, which pushed this note 120 ms late.)
    const { time, reanchored } = nextStepTime(9.955, 0.075, now, audioNow)
    expect(time).toBeCloseTo(10.03)
    expect(reanchored).toBe(false)
  })

  it('re-anchors only once the grid time has (nearly) passed, or ran far ahead', () => {
    expect(nextStepTime(9.9, 0.105, now, audioNow).reanchored).toBe(true) // 10.005 < 10.01
    expect(nextStepTime(9.9, 0.105, now, audioNow).time).toBe(now)
    expect(nextStepTime(10.2, 0.075, now, audioNow).reanchored).toBe(true) // 125 ms ahead
  })

  it('never schedules two steps at the same time', () => {
    const { time } = nextStepTime(10.15, 0, now, audioNow)
    expect(time).toBeCloseTo(10.151)
  })
})
