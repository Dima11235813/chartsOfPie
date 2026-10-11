import { describe, expect, it } from 'vitest'
import { noteTableFor } from '../core/composition/arranger'
import { getPreset } from '../core/composition/presets'
import { buildChartConfig, DIGIT_LABELS, symbolLabels } from '../components/chartConfig'
import {
  ringAngle,
  ringSegment,
  stringArtMultiplier,
  TransitionCounts,
  walkStep,
  WalkPath,
} from './art'
import { getPalette, INK, PALETTES, RAINBOW, SCRIABIN, TOL_LIGHT } from './palettes'

/** F05.5: every view layer takes k symbols; k = 10 must stay exactly as before. */
const original = getPreset('original')!.config
const notesFor = (k: number) => noteTableFor(original, k)

describe('palettes for k symbols', () => {
  it('give one colour per symbol for k = 2, 4, 10, 12 and 16', () => {
    for (const palette of PALETTES) {
      for (const k of [2, 4, 10, 12, 16]) {
        const colors = palette.digitColors(notesFor(k))
        expect(colors, `${palette.id} k=${k}`).toHaveLength(k)
        for (const c of colors) expect(c).toMatch(/^(#[0-9a-f]{6}|rgb\(\d+, \d+, \d+\))$/i)
      }
    }
  })

  it('ten symbols keep exactly the original colours', () => {
    expect(getPalette('rainbow').digitColors(notesFor(10))).toEqual([...RAINBOW])
    expect(getPalette('colour-blind').digitColors(notesFor(10))).toEqual([...TOL_LIGHT])
    expect(getPalette('ink').digitColors(notesFor(10))).toEqual([...INK])
  })

  it('more than ten are interpolated from first to last colour', () => {
    const ink = getPalette('ink').digitColors(notesFor(12))
    expect(ink[0]).toBe('rgb(43, 76, 126)') // INK[0] #2B4C7E
    expect(ink[11]).toBe('rgb(218, 241, 245)') // INK[9] #DAF1F5
    expect(new Set(getPalette('colour-blind').digitColors(notesFor(12))).size).toBe(12)
  })

  it('fewer than ten distinct symbols take the first colour-blind colours', () => {
    expect(getPalette('colour-blind').digitColors(notesFor(4))).toEqual(TOL_LIGHT.slice(0, 4))
  })

  it('Scriabin: mod 12 on semitones from C gets his twelve colours in order', () => {
    const notes = noteTableFor({ ...original, mapping: 'semitones' }, 12)
    expect(getPalette('scriabin').digitColors(notes)).toEqual([...SCRIABIN])
  })
})

describe('geometry for k symbols', () => {
  it('walk: twelve directions 30° apart, 3 pointing right like a clock', () => {
    const [x, y] = walkStep(3, 12)
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(0)
    const [x6, y6] = walkStep(6, 12)
    expect(x6).toBeCloseTo(0)
    expect(y6).toBeCloseTo(1) // 6 points down
    const walk = new WalkPath(2)
    walk.push(0)
    walk.push(1)
    expect(walk.ys[1]).toBeCloseTo(-1)
    expect(walk.ys[2]).toBeCloseTo(0) // binary: up, then straight back down
  })

  it('ten directions are unchanged', () => {
    expect(walkStep(7, 10)).toEqual(walkStep(7))
  })

  it('ring: k equal arcs that together go once round, each angle inside its arc', () => {
    for (const k of [2, 4, 12, 16]) {
      const [first] = ringSegment(0, k)
      const [, last] = ringSegment(k - 1, k)
      expect(last - first, `k=${k}`).toBeCloseTo(Math.PI * 2 - 0.06)
      const [start, end] = ringSegment(k - 1, k)
      for (let n = 0; n < 20; n++) {
        const a = ringAngle(k - 1, n, k)
        expect(a).toBeGreaterThanOrEqual(start)
        expect(a).toBeLessThanOrEqual(end)
      }
    }
    expect(ringSegment(4, 10)).toEqual(ringSegment(4))
  })

  it('transitions: a k × k table', () => {
    const counts = new TransitionCounts(12)
    counts.add(11, 10)
    counts.add(11, 10)
    counts.add(10, 11)
    expect([counts.get(11, 10), counts.get(10, 11), counts.get(10, 10)]).toEqual([2, 1, 0])
    expect(counts.max).toBe(2)
  })

  it('string art: the last two symbols as a base-k number, 2 + d₁ + d₂/k', () => {
    expect(stringArtMultiplier(11, 6, 12)).toBeCloseTo(13.5)
    expect(stringArtMultiplier(9, 9)).toBeCloseTo(11.9)
  })
})

describe('chart for k symbols', () => {
  it('labels 0–9 then A, B', () => {
    expect(symbolLabels(10)).toBe(DIGIT_LABELS)
    expect(symbolLabels(12)).toEqual([...DIGIT_LABELS, 'A', 'B'])
    const config = buildChartConfig('bar', new Array<number>(12).fill(1), '#fff', '#000')
    expect(config.data.labels).toHaveLength(12)
  })
})
