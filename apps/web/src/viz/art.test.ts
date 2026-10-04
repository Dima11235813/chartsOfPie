import { describe, expect, it } from 'vitest'
import {
  circlePointAngle,
  clockAngle,
  clockPosition,
  earlierNeighbours,
  fitBounds,
  mosaicColumnsCell,
  GOLDEN_ANGLE,
  ringAngle,
  ringSegment,
  RING_GAP,
  seedPosition,
  stringArtMultiplier,
  stringArtTarget,
  sunflowerCapacity,
  TransitionCounts,
  WalkPath,
  walkStep,
} from './art'
import { getPalette, PALETTES, paletteRamp, parseColor, SCRIABIN, withAlpha } from './palettes'

describe('π walk', () => {
  it('steps in ten directions, 0 up and clockwise', () => {
    const close = ([x, y]: [number, number], [ex, ey]: [number, number]) => {
      expect(x).toBeCloseTo(ex)
      expect(y).toBeCloseTo(ey)
    }
    close(walkStep(0), [0, -1])
    close(walkStep(5), [0, 1])
    close(walkStep(1), [Math.sin(Math.PI / 5), -Math.cos(Math.PI / 5)])
    for (let d = 0; d < 10; d++) expect(Math.hypot(...walkStep(d))).toBeCloseTo(1)
  })

  it('accumulates the path, its bounds, and grows past its initial capacity', () => {
    const walk = new WalkPath()
    walk.push(0)
    walk.push(0)
    walk.push(5)
    expect(walk.length).toBe(4)
    expect(walk.ys[2]).toBeCloseTo(-2)
    expect(walk.ys[3]).toBeCloseTo(-1)
    expect(walk.minY).toBeCloseTo(-2)
    for (let i = 0; i < 3000; i++) walk.push(i % 10)
    expect(walk.length).toBe(3004)
    expect(walk.xs.length).toBeGreaterThanOrEqual(3004)
  })

  it('fits bounds into a canvas, centred', () => {
    const fit = fitBounds(-10, 10, -5, 5, 400, 200, 1)
    expect(fit.scale).toBeCloseTo(20)
    expect(fit.offsetX).toBeCloseTo(200)
    expect(fit.offsetY).toBeCloseTo(100)
  })
})

describe('sunflower', () => {
  it('uses the golden angle ≈ 137.508°', () => {
    expect((GOLDEN_ANGLE * 180) / Math.PI).toBeCloseTo(137.508, 3)
  })

  it('places seed n at radius spacing·√n', () => {
    const [x, y] = seedPosition(16, 2)
    expect(Math.hypot(x, y)).toBeCloseTo(8)
    expect(seedPosition(0, 5)).toEqual([0, 0])
  })

  it('grows capacity by ×4 steps', () => {
    expect(sunflowerCapacity(1)).toBe(400)
    expect(sunflowerCapacity(400)).toBe(400)
    expect(sunflowerCapacity(401)).toBe(1600)
    expect(sunflowerCapacity(100_000)).toBe(102_400)
  })
})

describe('digit ring', () => {
  it('splits the circle into ten segments separated by a gap, starting at the top', () => {
    const [start0, end0] = ringSegment(0)
    expect(start0).toBeCloseTo(-Math.PI / 2 + RING_GAP / 2)
    expect(end0 - start0).toBeCloseTo((2 * Math.PI) / 10 - RING_GAP)
    expect(ringSegment(1)[0] - end0).toBeCloseTo(RING_GAP)
  })

  it('spreads link endpoints evenly within the segment and never moves old ones', () => {
    const [start, end] = ringSegment(3)
    const angles = Array.from({ length: 50 }, (_, k) => ringAngle(3, k))
    angles.forEach((a) => {
      expect(a).toBeGreaterThanOrEqual(start)
      expect(a).toBeLessThanOrEqual(end)
    })
    const sorted = [...angles].sort((a, b) => a - b)
    const gaps = sorted.slice(1).map((a, i) => a - sorted[i]!)
    expect(Math.max(...gaps)).toBeLessThan((end - start) / 10)
    expect(ringAngle(3, 7)).toBe(angles[7])
  })

  it('counts transitions', () => {
    const counts = new TransitionCounts()
    const pi = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]
    pi.slice(1).forEach((d, i) => counts.add(pi[i]!, d))
    expect(counts.get(1, 4)).toBe(1)
    expect(counts.get(5, 3)).toBe(1)
    expect(counts.max).toBe(1)
    counts.add(1, 4)
    expect(counts.max).toBe(2)
    counts.reset()
    expect(counts.get(1, 4)).toBe(0)
  })
})

describe('palettes', () => {
  const cPentatonic = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5']

  it('every palette gives ten colours', () => {
    for (const palette of PALETTES) expect(palette.digitColors(cPentatonic)).toHaveLength(10)
  })

  it('the colour-blind palette has ten distinct colours (the rainbow repeats three)', () => {
    expect(new Set(getPalette('colour-blind').digitColors(cPentatonic)).size).toBe(10)
    expect(new Set(getPalette('rainbow').digitColors(cPentatonic)).size).toBe(7)
  })

  it('Scriabin colours follow the pitch class of each digit’s note', () => {
    const colors = getPalette('scriabin').digitColors(cPentatonic)
    expect(colors[0]).toBe(SCRIABIN[0]) // C4 → C red
    expect(colors[5]).toBe(SCRIABIN[0]) // C5 → same red
    expect(colors[3]).toBe(SCRIABIN[7]) // G4 → orange
  })

  it('falls back to the default palette and converts colours to rgba', () => {
    expect(getPalette('nope').id).toBe('rainbow')
    expect(withAlpha('#ff8000', 0.5)).toBe('rgba(255, 128, 0, 0.5)')
    expect(withAlpha('rgb(1, 2, 3)', 0.25)).toBe('rgba(1, 2, 3, 0.25)')
  })
})

describe('neighbour mosaic', () => {
  test('a fixed column count picks the largest cell that fits the width and every digit', () => {
    // 10 columns in 400×300: 36 px fits the width (360) and 8 rows = 80 digits.
    expect(mosaicColumnsCell(400, 300, 10, 80, 1)).toBe(36)
    // 200 digits need 20 rows: 15 px gives 20 rows.
    expect(mosaicColumnsCell(400, 300, 10, 200, 1)).toBe(15)
    // Too many digits for any step: the smallest step, and the view scrolls.
    expect(mosaicColumnsCell(400, 300, 10, 1_000_000, 1)).toBe(3.5)
    // 120 columns in 300 px: even 3.5 px is too wide, so cells shrink to fit exactly.
    expect(mosaicColumnsCell(300, 300, 120, 10, 1)).toBe(2.5)
    // Device pixel ratio scales the steps.
    expect(mosaicColumnsCell(800, 600, 10, 80, 2)).toBe(72)
  })

  it('lists earlier neighbours without wrapping across rows', () => {
    expect(earlierNeighbours(0, 5)).toEqual([])
    expect(earlierNeighbours(3, 5)).toEqual([2])
    expect(earlierNeighbours(5, 5)).toEqual([0, 1]) // row start: up, up-right
    expect(earlierNeighbours(7, 5)).toEqual([6, 1, 2, 3])
    expect(earlierNeighbours(9, 5)).toEqual([8, 3, 4]) // row end: no up-right
  })
})

describe('times-table string art', () => {
  it('derives the multiplier from the two latest digits', () => {
    expect(stringArtMultiplier(3, 1)).toBeCloseTo(5.1)
    expect(stringArtMultiplier(0, 0)).toBe(2) // the cardioid
    expect(stringArtMultiplier(9, 9)).toBeCloseTo(11.9)
  })

  it('maps n to k·n mod N', () => {
    expect(stringArtTarget(7, 2, 10)).toBe(4)
    expect(stringArtTarget(3, 2.5, 10)).toBeCloseTo(7.5)
    expect(circlePointAngle(0, 12)).toBeCloseTo(-Math.PI / 2)
    expect(circlePointAngle(3, 12)).toBeCloseTo(0)
  })
})

describe('music clock', () => {
  it('orders pitch classes chromatically or by fifths', () => {
    expect([0, 1, 7, 11].map((pc) => clockPosition(pc, 'chromatic'))).toEqual([0, 1, 7, 11])
    // circle of fifths: C=0, G=1, D=2, A=3, E=4, B=5, F♯=6, C♯=7 … F=11
    expect([0, 7, 2, 9, 4, 11, 6, 1, 5].map((pc) => clockPosition(pc, 'fifths'))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 11,
    ])
    expect(clockPosition(-1, 'chromatic')).toBe(11)
    expect(clockAngle(0, 'fifths')).toBeCloseTo(-Math.PI / 2)
  })
})

describe('palette ramp', () => {
  it('interpolates through the palette from the first to the last colour', () => {
    const ramp = paletteRamp(['#000000', '#ffffff'], 3)
    expect(ramp).toEqual(['rgb(0, 0, 0)', 'rgb(128, 128, 128)', 'rgb(255, 255, 255)'])
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3])
    expect(parseColor('hsl(0, 0%, 0%)')).toBeNull()
  })
})
