import { describe, expect, it } from 'vitest'
import { windowFrom } from '../core/digits/digitSource'
import { fibonacciConcatenated } from '../core/series/fibonacci'
import { loadSource } from '../core/series/load'
import { TRIANGLE_LAYOUT, triangleRow, wallCell, wallExtent, wallLayoutFor } from './placeValue'

describe('place-value wall: one row per number, right-aligned', () => {
  // 0 1 1 2 3 5 8 | 13 21 34 55 89 | 144 233 …: rows 0–6 hold one digit, 7–11 two, 12– three.
  const { terms } = fibonacciConcatenated(200)
  const wall = wallLayoutFor({ terms })

  it('puts each Fibonacci number on its own row', () => {
    expect(wall.kind).toBe('terms')
    expect([0, 6, 7, 8, 9, 17, 19, 20].map(wall.row)).toEqual([0, 6, 7, 7, 8, 12, 12, 13])
  })

  it('counts places from the right: the 1 of 144 is the hundreds, its last 4 the units', () => {
    expect([17, 18, 19].map(wall.place)).toEqual([2, 1, 0])
    expect([7, 8].map(wall.place)).toEqual([1, 0]) // 13
    expect(wall.place(0)).toBe(0)
  })

  it('measures rows and the widest number', () => {
    expect(wallExtent(wall, 7)).toEqual({ rows: 7, width: 1 })
    expect(wallExtent(wall, 18)).toEqual({ rows: 13, width: 3 }) // inside 144
  })

  it('in base 12 the units column is Fₙ mod 12 and the twelves column also loops every 24 rows', () => {
    const base12 = fibonacciConcatenated(20_000, 12)
    const layout = wallLayoutFor({ terms: base12.terms })
    const column = (place: number) => {
      const out = new Map<number, number>()
      for (let i = 0; i < 20_000; i++)
        if (layout.place(i) === place) out.set(layout.row(i), base12.symbols[i]!)
      return out
    }
    const units = column(0)
    const twelves = column(1)
    // From row 31 both rows compared have a twelves digit (Fₙ ≥ 12 from n = 7).
    for (let r = 31; r < 300; r++) {
      expect(units.get(r)).toBe(units.get(r - 24))
      expect(twelves.get(r)).toBe(twelves.get(r - 24))
    }
    // Every 12th number ends in 00.
    for (let r = 12; r < 300; r += 12) expect([units.get(r), twelves.get(r)]).toEqual([0, 0])
  })

  it('starting mid-number keeps every digit in its true place', async () => {
    const source = await loadSource({ version: 1, series: 'fibonacci', reading: 'concat' })
    const from18 = wallLayoutFor(windowFrom(source, 18)) // the 4 4 of 144
    expect([from18.row(0), from18.place(0), from18.place(1)]).toEqual([0, 1, 0])
    expect([from18.row(2), from18.place(2)]).toEqual([1, 2]) // 233 on the next row
  })

  it('periodic readings and constants use the triangle', async () => {
    const mod12 = await loadSource({ version: 1, series: 'fibonacci', reading: 'mod-12' })
    expect(wallLayoutFor(mod12).kind).toBe('triangle')
    expect(wallLayoutFor({}).kind).toBe('triangle')
  })
})

describe('place-value wall: the triangle', () => {
  it('row r holds r + 1 digits', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10].map(triangleRow)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
    // Row 2 is symbols 3, 4, 5: places 2, 1, 0.
    expect([3, 4, 5].map(TRIANGLE_LAYOUT.place)).toEqual([2, 1, 0])
    expect(wallExtent(TRIANGLE_LAYOUT, 10)).toEqual({ rows: 4, width: 4 })
    expect(wallExtent(TRIANGLE_LAYOUT, 0)).toEqual({ rows: 0, width: 0 })
  })

  it('stays exact far out (no floating-point slip at a row start)', () => {
    for (const r of [1_000, 1_413, 44_720]) {
      const start = (r * (r + 1)) / 2
      expect(triangleRow(start)).toBe(r)
      expect(triangleRow(start - 1)).toBe(r - 1)
    }
  })
})

describe('wall cell size', () => {
  it('fits both ways, capped', () => {
    expect(wallCell(800, 600, 10, 40, 36)).toBe(20)
    expect(wallCell(800, 600, 100, 10, 36)).toBe(6)
    expect(wallCell(800, 600, 1, 1, 36)).toBe(36)
  })
})
