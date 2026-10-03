import { describe, expect, it } from 'vitest'
import { hilbertPoint, hilbertSide, runLengthEndingAt } from './art'
import { frequencyOf, harmonographPoints, intervalRatio } from './harmonograph'

describe('Hilbert curve', () => {
  it('visits the 2×2 grid in the classic U order', () => {
    expect([0, 1, 2, 3].map((d) => hilbertPoint(2, d))).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ])
  })

  it('covers every cell exactly once with each step to an adjacent cell', () => {
    const n = 32
    const seen = new Set<string>()
    let [px, py] = hilbertPoint(n, 0)
    for (let d = 0; d < n * n; d++) {
      const [x, y] = hilbertPoint(n, d)
      seen.add(`${x},${y}`)
      if (d > 0) expect(Math.abs(x - px) + Math.abs(y - py)).toBe(1)
      ;[px, py] = [x, y]
    }
    expect(seen.size).toBe(n * n)
  })

  it('keeps the first 4^k cells in the corner square of side 2^k (what the live zoom relies on)', () => {
    for (const k of [0, 1, 3, 5]) {
      const side = 2 ** k
      for (let d = 0; d < side * side; d++) {
        const [x, y] = hilbertPoint(1024, d)
        expect(x).toBeLessThan(side)
        expect(y).toBeLessThan(side)
      }
    }
  })

  it('picks the smallest power-of-two side', () => {
    expect(hilbertSide(1)).toBe(1)
    expect(hilbertSide(1000)).toBe(32)
    expect(hilbertSide(1_000_000)).toBe(1024)
    expect(hilbertSide(1_000_001)).toBe(1024) // 1024² = 1,048,576 ≥ the 3 + 1M decimals
  })
})

describe('runs', () => {
  it('measures the run of equal digits ending at an index', () => {
    const digits = [3, 1, 4, 4, 4, 2]
    const at = (i: number) => digits[i]!
    expect(runLengthEndingAt(at, 0)).toBe(1)
    expect(runLengthEndingAt(at, 3)).toBe(2)
    expect(runLengthEndingAt(at, 4)).toBe(3)
    expect(runLengthEndingAt(at, 5)).toBe(1)
  })
})

describe('harmonograph', () => {
  it('uses equal temperament with A4 = 440 Hz', () => {
    expect(frequencyOf(69)).toBeCloseTo(440)
    expect(frequencyOf(81)).toBeCloseTo(880)
    expect(frequencyOf(60)).toBeCloseTo(261.626, 2)
  })

  it('relates tempered intervals to just ratios in cents', () => {
    const fifth = intervalRatio(60, 67)
    expect(fifth.tempered).toBeCloseTo(1.4983, 4)
    expect(fifth.just).toEqual([3, 2])
    expect(fifth.cents).toBeCloseTo(-1.955, 2) // tempered fifth is ~2 cents flat
    const third = intervalRatio(60, 64)
    expect(third.just).toEqual([5, 4])
    expect(third.cents).toBeCloseTo(13.686, 2) // tempered major third is ~14 cents sharp
    expect(intervalRatio(60, 79).just).toEqual([6, 2]) // octave + fifth
    expect(intervalRatio(60, 60).cents).toBeCloseTo(0)
  })

  it('produces a decaying figure inside the unit square', () => {
    const points = harmonographPoints(1.5, 0, { samples: 100 })
    expect(points).toHaveLength(200)
    for (const v of points) expect(Math.abs(v)).toBeLessThanOrEqual(1)
    const last = Math.hypot(points[198]!, points[199]!)
    expect(last).toBeLessThanOrEqual(Math.SQRT2 * 0.25 + 1e-6)
  })
})
