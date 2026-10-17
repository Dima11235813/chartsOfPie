import { describe, expect, it } from 'vitest'
import { createTimingStats } from './timingStats'

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
