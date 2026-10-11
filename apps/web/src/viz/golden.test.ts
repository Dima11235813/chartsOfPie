import { describe, expect, it } from 'vitest'
import { goldenCell, goldenLayout, goldenSquaresFor, MIN_GOLDEN_SQUARES } from './golden'

// F₁ … F₁₇ (OEIS A000045).
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]

describe('golden rectangle', () => {
  it('k squares of side F₁ … Fₖ make an Fₖ × Fₖ₊₁ rectangle (1² + 1² + … + Fₖ² = Fₖ·Fₖ₊₁)', () => {
    for (let k = 1; k <= 12; k++) {
      const layout = goldenLayout(k)
      expect(layout.squares.map((s) => s.side)).toEqual(FIB.slice(0, k))
      const sides = [layout.width, layout.height].sort((a, b) => a - b)
      expect(sides, `k=${k}`).toEqual(k === 1 ? [1, 1] : [FIB[k - 1], FIB[k]])
      expect(layout.cells).toBe(FIB[k - 1]! * FIB[k]!)
    }
  })

  it('lays the squares right, top, left, bottom around the growing rectangle', () => {
    const { squares } = goldenLayout(6)
    expect(squares.map(({ x, y, side }) => [x, y, side])).toEqual([
      [0, 0, 1],
      [1, 0, 1], // right of the first
      [0, -2, 2], // on top of 2 × 1
      [-3, -2, 3], // left of 2 × 3
      [-3, 1, 5], // under 5 × 3
      [2, -2, 8], // right of 5 × 8
    ])
  })

  it('tiles every cell exactly once, square by square from the centre outwards', () => {
    const layout = goldenLayout(8)
    const seen = new Set<string>()
    for (let i = 0; i < layout.cells; i++) {
      const [x, y] = goldenCell(layout, i)!
      expect(x).toBeGreaterThanOrEqual(layout.minX)
      expect(y).toBeGreaterThanOrEqual(layout.minY)
      expect(x).toBeLessThan(layout.minX + layout.width)
      expect(y).toBeLessThan(layout.minY + layout.height)
      seen.add(`${x},${y}`)
    }
    expect(seen.size).toBe(layout.cells)
    expect(goldenCell(layout, layout.cells)).toBeNull()
    // Digit 0 is the first unit square; digit 4 starts the 3 × 3 square, in reading order.
    expect(goldenCell(layout, 0)).toEqual([0, 0])
    expect(goldenCell(layout, 6)).toEqual([-3, -2])
    expect(goldenCell(layout, 7)).toEqual([-2, -2])
    expect(goldenCell(layout, 9)).toEqual([-3, -1])
  })

  it('the quarter circles join into one spiral, each of radius its square’s side', () => {
    const { squares } = goldenLayout(10)
    for (const [i, { arc, side }] of squares.entries()) {
      expect(Math.hypot(arc.from[0] - arc.cx, arc.from[1] - arc.cy)).toBe(side)
      expect(Math.hypot(arc.to[0] - arc.cx, arc.to[1] - arc.cy)).toBe(side)
      if (i > 0) expect(arc.from).toEqual(squares[i - 1]!.arc.to)
    }
  })

  it('the long side over the short one closes in on φ', () => {
    const ratio = (k: number) => {
      const { width, height } = goldenLayout(k)
      return Math.max(width, height) / Math.min(width, height)
    }
    expect(ratio(10)).toBeCloseTo((1 + Math.sqrt(5)) / 2, 3) // 89/55 = 1.61818
    expect(Math.abs(ratio(14) - (1 + Math.sqrt(5)) / 2)).toBeLessThan(1e-5) // 610/377
  })

  it('uses the fewest squares that hold the digits (at least five)', () => {
    expect(goldenSquaresFor(1)).toBe(MIN_GOLDEN_SQUARES)
    expect(goldenSquaresFor(40)).toBe(5) // 5 × 8
    expect(goldenSquaresFor(41)).toBe(6) // 8 × 13 = 104
    expect(goldenSquaresFor(1_000_000)).toBe(16) // 987 × 1597
  })
})
