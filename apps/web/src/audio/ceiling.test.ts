import { describe, expect, it } from 'vitest'
import { CEILING_RANGE, ceilingCurve, ceilingMode, SAFETY, SOFT_CLIP } from './ceiling'

describe('master ceiling curves', () => {
  it.each([
    ['safety', SAFETY, 0.85, 0.97],
    ['soft clip', SOFT_CLIP, 0.8, 0.98],
  ] as const)(
    '%s is the identity below its knee and stays under its ceiling',
    (_, transfer, knee, ceiling) => {
      for (let x = -knee; x <= knee; x += 0.01) expect(transfer(x)).toBeCloseTo(x, 12)
      for (const x of [1, 1.5, 2, CEILING_RANGE, 100]) {
        expect(transfer(x)).toBeLessThanOrEqual(ceiling)
        expect(transfer(-x)).toBeGreaterThanOrEqual(-ceiling)
      }
    },
  )

  it('is monotonic, so louder input is never quieter output', () => {
    for (const transfer of [SAFETY, SOFT_CLIP]) {
      let previous = -Infinity
      for (let x = -CEILING_RANGE; x <= CEILING_RANGE; x += 0.001) {
        const y = transfer(x)
        expect(y).toBeGreaterThanOrEqual(previous)
        previous = y
      }
    }
  })

  it('samples the curve over ±CEILING_RANGE, centred on zero', () => {
    const curve = ceilingCurve(SAFETY)
    expect(curve.length % 2).toBe(1)
    expect(curve[(curve.length - 1) / 2]).toBe(0)
    expect(curve[0]).toBeCloseTo(SAFETY(-CEILING_RANGE), 6)
    expect(curve.at(-1)).toBeCloseTo(SAFETY(CEILING_RANGE), 6)
    // Index for input 0.5 (pre-scaled to 0.5 / CEILING_RANGE) holds exactly 0.5: identity region.
    const index = ((0.5 / CEILING_RANGE + 1) / 2) * (curve.length - 1)
    expect(curve[index]).toBeCloseTo(0.5, 6)
  })

  describe('ceilingMode', () => {
    const original = { compress: false, volume: 0, reverb: 0, echo: 0, drone: null }

    it('leaves the Original preset at its own level exactly as in 2019', () => {
      expect(ceilingMode(original)).toBe('transparent')
      expect(ceilingMode({ ...original, volume: -6 })).toBe('transparent')
    })

    it.each([
      ['volume up', { volume: 1 }],
      ['reverb', { reverb: 0.2 }],
      ['echo', { echo: 0.2 }],
      ['a drone', { drone: ['C3', 'G3'] }],
    ])('guards Original against clipping once %s is added', (_, change) => {
      expect(ceilingMode({ ...original, ...change })).toBe('safety')
    })

    it('uses the soft clipper whenever compression is on', () => {
      expect(ceilingMode({ ...original, compress: true })).toBe('soft-clip')
    })
  })
})
