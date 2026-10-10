import { describe, expect, it } from 'vitest'
import {
  circlePointAngle,
  decimalPointCell,
  loopColumnWidths,
  clockAngle,
  clockPosition,
  earlierNeighbours,
  fitBounds,
  mosaicFill,
  mosaicGroupSizes,
  sweepColumns,
  fibonacciRatio,
  GOLDEN_ANGLE,
  PHI,
  spiralNeighbours,
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
import {
  getPalette,
  mixColors,
  PALETTES,
  paletteRamp,
  parseColor,
  SCRIABIN,
  withAlpha,
} from './palettes'
import { choosePosition, foldIntoRange, getTuning, positionsOf } from './fretboard'
import {
  chordDisplacement,
  displacement,
  gradient,
  modeForMidi,
  MODES,
  plateField,
  sampleField,
  settleGrains,
} from './chladni'
import { seededRandom } from '../core/random/seededRandom'
import { midiToNote, noteToMidi } from '../core/music/notes'

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

  it('the two nearest earlier seeds are always consecutive Fibonacci numbers back', () => {
    // Checked against a brute-force nearest-neighbour search over every earlier seed.
    const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
    const brute = (n: number) => {
      const [x, y] = seedPosition(n, 1)
      return Array.from({ length: n }, (_, k) => k + 1)
        .map((k) => {
          const [px, py] = seedPosition(n - k, 1)
          return [Math.hypot(x - px, y - py), k] as const
        })
        .sort((a, b) => a[0] - b[0])
        .slice(0, 2)
        .map(([, k]) => k)
        .sort((a, b) => a - b)
    }
    for (const n of [50, 99, 100, 401, 1000, 1600, 5000]) {
      const pair = spiralNeighbours(n)!
      expect(pair).toEqual(brute(n))
      expect(FIB.indexOf(pair[1])).toBe(FIB.indexOf(pair[0]) + 1)
    }
    // The classic sunflower counts: 21/34 near the centre, 34/55 at 400 seeds, 89/144 at 1,600.
    expect(spiralNeighbours(100)).toEqual([21, 34])
    expect(spiralNeighbours(400)).toEqual([34, 55])
    expect(spiralNeighbours(1600)).toEqual([89, 144])
    expect(spiralNeighbours(0)).toBeNull()
  })

  it('grows capacity by ×4 steps', () => {
    expect(sunflowerCapacity(1)).toBe(400)
    expect(sunflowerCapacity(400)).toBe(400)
    expect(sunflowerCapacity(401)).toBe(1600)
    expect(sunflowerCapacity(100_000)).toBe(102_400)
  })
})

describe('typographic decimal point (B-021)', () => {
  it('follows the first cell only for a constant played from its start', () => {
    expect(decimalPointCell('constant', 0)).toBe(0) // 3.14159…
    // After a jump to the Feynman point the first cell is decimal 762, not the integer part.
    expect(decimalPointCell('constant', 762)).toBeNull()
    // Fibonacci numbers are whole numbers: no point at all.
    expect(decimalPointCell('integers', 0)).toBeNull()
  })
})

describe('loop widths', () => {
  it('divide the loop: Fibonacci last digits (60) line up at 12, 15, 20, 30 and 60 columns', () => {
    expect(loopColumnWidths(60)).toEqual([12, 15, 20, 30, 60])
    expect(loopColumnWidths(24)).toEqual([12, 24])
    expect(loopColumnWidths(7)).toEqual([])
  })
})

describe('golden ratio', () => {
  it('φ = (1 + √5)/2 and 1/φ = φ − 1', () => {
    expect(PHI).toBeCloseTo(1.6180339887, 10)
    expect(1 / PHI).toBeCloseTo(PHI - 1, 12)
  })

  it('Fibonacci ratios 2/1, 3/2, 5/3, 8/5… alternate around φ and close in on it', () => {
    const steps = Array.from({ length: 12 }, (_, i) => fibonacciRatio(i))
    expect(steps.slice(0, 5).map(({ p, q }) => `${p}/${q}`)).toEqual([
      '2/1',
      '3/2',
      '5/3',
      '8/5',
      '13/8',
    ])
    for (let i = 0; i < steps.length; i++) {
      const error = steps[i]!.ratio - PHI
      expect(Math.sign(error)).toBe(i % 2 === 0 ? 1 : -1) // above, below, above…
      if (i > 0) expect(Math.abs(error)).toBeLessThan(Math.abs(steps[i - 1]!.ratio - PHI))
    }
    expect(steps[11]!.ratio).toBeCloseTo(PHI, 4) // 377/233
    expect(fibonacciRatio(12)).toEqual(fibonacciRatio(0)) // wraps and converges again
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
  test('a fixed column count spans the whole width, at most a third of the frame per cell', () => {
    // 10 columns in 400×300: 40 px cells fill the width, whatever the digit count (then it scrolls).
    expect(mosaicFill(400, 300, 10, 80, 1)).toEqual({ columns: 10, cell: 40 })
    expect(mosaicFill(400, 300, 10, 1_000_000, 1)).toEqual({ columns: 10, cell: 40 })
    // 2 columns would be 200 px: capped at 300 / 3 so three rows still show.
    expect(mosaicFill(400, 300, 2, 5, 1)).toEqual({ columns: 2, cell: 100 })
    // 120 columns in 300 px: 2.5 px cells.
    expect(mosaicFill(300, 300, 120, 10, 1)).toEqual({ columns: 120, cell: 2.5 })
  })

  test('Fit starts with big dots and shrinks them as digits arrive, always filling the width', () => {
    // 400×300: the biggest cell is 100 px, i.e. 4 columns × 3 rows = 12 digits.
    expect(mosaicFill(400, 300, 0, 1, 1)).toEqual({ columns: 4, cell: 100 })
    expect(mosaicFill(400, 300, 0, 12, 1)).toEqual({ columns: 4, cell: 100 })
    // 13 digits: the next step, 5 columns of 80 px × 3 rows = 15.
    expect(mosaicFill(400, 300, 0, 13, 1)).toEqual({ columns: 5, cell: 80 })
    // 1,000 digits: 37 columns × 27 rows = 999 is one short; the next step, 43 × 32, fits.
    expect(mosaicFill(400, 300, 0, 999, 1).columns).toBe(37)
    expect(mosaicFill(400, 300, 0, 1000, 1).columns).toBe(43)
    // Far more than fit: 8 px cells (50 columns), and the view scrolls.
    expect(mosaicFill(400, 300, 0, 1_000_000, 1)).toEqual({ columns: 50, cell: 8 })
    // Never more columns than the slider offers.
    expect(mosaicFill(4000, 1000, 0, 1_000_000, 1).columns).toBe(120)
    // Device pixels: the minimum cell scales with the pixel ratio.
    expect(mosaicFill(800, 600, 0, 1_000_000, 2)).toEqual({ columns: 50, cell: 16 })
  })

  it('lists earlier neighbours without wrapping across rows', () => {
    expect(earlierNeighbours(0, 5)).toEqual([])
    expect(earlierNeighbours(3, 5)).toEqual([2])
    expect(earlierNeighbours(5, 5)).toEqual([0, 1]) // row start: up, up-right
    expect(earlierNeighbours(7, 5)).toEqual([6, 1, 2, 3])
    expect(earlierNeighbours(9, 5)).toEqual([8, 3, 4]) // row end: no up-right
  })

  it('measures the group each cell belongs to (8-connected equal digits)', () => {
    // 4 columns:
    //   1 1 2 3
    //   4 1 5 3
    //   6 7 1 9
    const grid = [1, 1, 2, 3, 4, 1, 5, 3, 6, 7, 1, 9]
    expect([...mosaicGroupSizes(grid, 4)]).toEqual([4, 4, 1, 2, 1, 4, 1, 2, 1, 1, 4, 1])
    // The same digits in 3 columns regroup: the 3s and the last 1 lose their neighbours, and
    // the 1 at row 2 now touches the first row's pair diagonally.
    //   1 1 2 / 3 4 1 / 5 3 6 / 7 1 9
    expect([...mosaicGroupSizes(grid, 3)]).toEqual([3, 3, 1, 2, 1, 3, 1, 2, 1, 1, 1, 1])
  })

  it('does not join across the end of a row', () => {
    // 3 columns: "1 2 1 / 1 …" — the last 1 of row 1 and the first of row 2 are not neighbours…
    // …but the first 1 of row 2 sits right under the first of row 1.
    expect([...mosaicGroupSizes([1, 2, 1, 1], 3)]).toEqual([2, 1, 1, 2])
  })

  it('keeps rows aligned to absolute positions after scrolling', () => {
    // "5 5" at cells 0, 1 are neighbours; at cells 3, 4 of a 4-column grid they sit at the end
    // of one row and the start of the next, so they are not.
    expect([...mosaicGroupSizes([5, 5], 4, 0)]).toEqual([2, 2])
    expect([...mosaicGroupSizes([5, 5], 4, 3)]).toEqual([1, 1])
  })

  it('sweeps the column count up and back down at an even pace', () => {
    const at = (t: number) => sweepColumns(t, 10, 14, 2)
    expect([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(at)).toEqual([
      10, 11, 12, 13, 14, 13, 12, 11, 10,
    ])
    expect(sweepColumns(5, 8, 8, 2)).toBe(8)
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

describe('guitar fretboard', () => {
  const standard = getTuning('standard').strings

  test('standard tuning is E2 A2 D3 G3 B3 E4', () => {
    expect(standard.map((m) => midiToNote(m))).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4'])
    expect(getTuning('drop-d').strings.map((m) => midiToNote(m))).toEqual([
      'D2',
      'A2',
      'D3',
      'G3',
      'B3',
      'E4',
    ])
    expect(getTuning('dadgad').strings.map((m) => midiToNote(m))).toEqual([
      'D2',
      'A2',
      'D3',
      'G3',
      'A3',
      'D4',
    ])
    expect(getTuning('open-g').strings.map((m) => midiToNote(m))).toEqual([
      'D2',
      'G2',
      'D3',
      'G3',
      'B3',
      'D4',
    ])
  })

  test('E4 sits on four strings: open high E, B string 5, G string 9, D string 14', () => {
    expect(positionsOf(noteToMidi('E4'), standard)).toEqual([
      { string: 2, fret: 14 },
      { string: 3, fret: 9 },
      { string: 4, fret: 5 },
      { string: 5, fret: 0 },
    ])
    // Middle C (C4): A string 15, D string 10, G string 5, B string 1.
    expect(positionsOf(noteToMidi('C4'), standard).map((p) => p.fret)).toEqual([15, 10, 5, 1])
  })

  test('notes outside the range fold by octaves', () => {
    expect(foldIntoRange(noteToMidi('C2'), standard)).toEqual({
      midi: noteToMidi('C3'),
      folded: true,
    })
    // The top note is G5 (high E, fret 15), so A6 comes down two octaves.
    expect(foldIntoRange(noteToMidi('A6'), standard)).toEqual({
      midi: noteToMidi('A4'),
      folded: true,
    })
    expect(foldIntoRange(noteToMidi('G5'), standard)).toEqual({
      midi: noteToMidi('G5'),
      folded: false,
    })
  })

  test('the hand stays near where it is, preferring low frets and open strings', () => {
    const e4 = positionsOf(noteToMidi('E4'), standard)
    expect(choosePosition(e4, null)).toEqual({ string: 5, fret: 0 })
    expect(choosePosition(e4, 9)).toEqual({ string: 5, fret: 0 }) // open strings need no reach
    const c4 = positionsOf(noteToMidi('C4'), standard)
    expect(choosePosition(c4, 9)).toEqual({ string: 2, fret: 10 })
    expect(choosePosition(c4, 4)).toEqual({ string: 3, fret: 5 })
    expect(choosePosition([], 3)).toBeNull()
  })
})

describe('Chladni plate (cymatics)', () => {
  test('modes rise with n² + m²: (1,2) is the lowest, then (1,3), (2,3), (1,4)', () => {
    expect(MODES.slice(0, 4)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
      [1, 4],
    ])
    const energy = MODES.map(([n, m]) => n * n + m * m)
    expect(energy).toEqual([...energy].sort((a, b) => a - b))
  })

  test('the diagonal is a nodal line of every (n, m) mode', () => {
    for (const mode of MODES.slice(0, 12)) {
      for (const t of [0.1, 0.37, 0.8]) {
        expect(displacement(t, t, mode)).toBeCloseTo(0, 12)
      }
    }
    // The anti-diagonal x + y = 1 is still too when n + m is even, e.g. (1,3), but not (1,2).
    expect(displacement(0.3, 0.7, [1, 3])).toBeCloseTo(0, 12)
    expect(Math.abs(displacement(0.3, 0.7, [1, 2]))).toBeGreaterThan(0.1)
  })

  test('higher notes pick finer modes; a chord averages its modes', () => {
    expect(modeForMidi(60, 60)).toEqual([1, 2])
    expect(modeForMidi(67, 60)).toEqual(MODES[7])
    expect(modeForMidi(10, 60)).toEqual([1, 2])
    expect(chordDisplacement(0.2, 0.6, [[1, 2]])).toBeCloseTo(displacement(0.2, 0.6, [1, 2]))
    expect(chordDisplacement(0.2, 0.6, [])).toBe(0)
  })
})

describe('Chladni sand', () => {
  test('the gradient matches finite differences', () => {
    const mode = [2, 5] as const
    const h = 1e-6
    for (const [x, y] of [
      [0.21, 0.73],
      [0.5, 0.1],
    ]) {
      const [gx, gy] = gradient(x!, y!, mode)
      expect(gx).toBeCloseTo(
        (displacement(x! + h, y!, mode) - displacement(x! - h, y!, mode)) / (2 * h),
        4,
      )
      expect(gy).toBeCloseTo(
        (displacement(x!, y! + h, mode) - displacement(x!, y! - h, mode)) / (2 * h),
        4,
      )
    }
  })

  test('sand gathers on the nodal lines within about a second of frames', () => {
    const random = seededRandom(3)
    const sand = new Float32Array(4000).map(() => random())
    const mode = MODES[5]!
    const meanAbs = () => {
      let sum = 0
      for (let i = 0; i < sand.length; i += 2)
        sum += Math.abs(displacement(sand[i]!, sand[i + 1]!, mode))
      return sum / (sand.length / 2)
    }
    const before = meanAbs()
    for (let frame = 0; frame < 60 * 3; frame++) settleGrains(sand, mode, random)
    expect(meanAbs()).toBeLessThan(before * 0.25)
  })
})

test('mixColors blends towards a second colour', () => {
  expect(mixColors('rgb(0, 0, 0)', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)')
  expect(mixColors('#ff0000', '#0000ff', 0)).toBe('rgb(255, 0, 0)')
  expect(mixColors('nonsense', '#ffffff', 0.5)).toBe('nonsense')
})

test('the tabulated plate field matches the formula closely', () => {
  const mode = MODES[9]!
  const field = plateField(mode)
  let worst = 0
  for (const [x, y] of [
    [0.123, 0.456],
    [0.5, 0.5],
    [0.987, 0.01],
    [0.333, 0.777],
  ] as const) {
    const [f, gx, gy] = sampleField(field, x, y)
    const [ex, ey] = gradient(x, y, mode)
    worst = Math.max(worst, Math.abs(f - displacement(x, y, mode)))
    // Gradients are ~10× larger than f; compare relative to their scale.
    worst = Math.max(worst, Math.abs(gx - ex) / 10, Math.abs(gy - ey) / 10)
  }
  expect(worst).toBeLessThan(0.01)
  expect(plateField(mode)).toBe(field) // cached
})
