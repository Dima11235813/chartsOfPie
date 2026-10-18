import { describe, expect, it } from 'vitest'
import { freeKey } from './polyplets'
import {
  DEAD,
  LifeHistory,
  lifeSeed,
  lifeStep,
  newbornColour,
  population,
  type LifeGrid,
} from './life'

/** A grid from rows of text: '.' dead, a digit alive with that colour. */
const parse = (rows: string[]): LifeGrid =>
  Int8Array.from(rows.join(''), (ch) => (ch === '.' ? DEAD : Number(ch)))
const show = (grid: LifeGrid, cols: number) =>
  Array.from({ length: grid.length / cols }, (_, y) =>
    Array.from(grid.subarray(y * cols, (y + 1) * cols), (v) => (v === DEAD ? '.' : String(v))).join(
      '',
    ),
  )

describe('Game of Life rules (B3/S23)', () => {
  it('a block is a still life', () => {
    const block = ['......', '.11...', '.11...', '......']
    expect(show(lifeStep(parse(block), 6, 4), 6)).toEqual(block)
  })

  it('a blinker turns every generation (period 2)', () => {
    const blinker = ['.....', '..3..', '..3..', '..3..', '.....']
    const once = lifeStep(parse(blinker), 5, 5)
    expect(show(once, 5)).toEqual(['.....', '.....', '.333.', '.....', '.....'])
    expect(show(lifeStep(once, 5, 5), 5)).toEqual(blinker)
  })

  it('wraps round the edges: a glider crosses an 8 × 8 torus and is back after 32 generations', () => {
    const glider = [
      '.7......',
      '..7.....',
      '777.....',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]
    let grid = parse(glider)
    for (let g = 0; g < 32; g++) {
      grid = lifeStep(grid, 8, 8)
      expect(population(grid)).toBe(5) // never broken by a wall
    }
    expect(show(grid, 8)).toEqual(glider)
  })

  it('a newborn takes the colour most parents share, else the middle digit', () => {
    expect(newbornColour(4, 4, 9)).toBe(4)
    expect(newbornColour(2, 7, 7)).toBe(7)
    expect(newbornColour(9, 1, 5)).toBe(5)
    expect(newbornColour(0, 8, 3)).toBe(3)
    // Survivors keep their own colour; the blinker's ends are born from mixed parents.
    const mixed = ['.....', '..1..', '..5..', '..9..', '.....']
    expect(show(lifeStep(parse(mixed), 5, 5), 5)[2]).toBe('.555.')
  })
})

describe('seed from the mosaic', () => {
  // 4 columns: 1 1 2 3 / 4 2 2 5 / 6 7 8 2 — the 1s link, the three 2s link (diagonally to the
  // last 2 as well: 2 at index 6 and 11 are diagonal neighbours).
  const digits = [1, 1, 2, 3, 4, 2, 2, 5, 6, 7, 8, 2]

  it('every digit: alive when linked to an equal neighbour', () => {
    const grid = lifeSeed({ cols: 4, rows: 3, digits, first: 0, minGroup: 0 })
    expect(show(grid, 4)).toEqual(['112.', '.22.', '...2'])
  })

  it('groups of 3+: only groups that big', () => {
    const grid = lifeSeed({ cols: 4, rows: 3, digits, first: 0, minGroup: 3 })
    expect(show(grid, 4)).toEqual(['..2.', '.22.', '...2'])
  })

  it('a picked shape: only groups of that shape', () => {
    const pair = freeKey([
      [0, 0],
      [1, 0],
    ])
    const grid = lifeSeed({ cols: 4, rows: 3, digits, first: 0, minGroup: 0, shape: pair })
    expect(show(grid, 4)).toEqual(['11..', '....', '....'])
  })

  it('cells past the last digit are dead, and groups are aligned to absolute positions', () => {
    const grid = lifeSeed({ cols: 4, rows: 4, digits, first: 400, minGroup: 0 })
    expect(show(grid, 4)[3]).toBe('....')
    expect(population(grid)).toBe(6)
  })
})

describe('telling when the game has settled', () => {
  it('finds a still life, an oscillator and extinction', () => {
    const still = new LifeHistory()
    const block = parse(['....', '.11.', '.11.', '....'])
    expect(still.record(block, 0)).toEqual({ kind: 'running' })
    expect(still.record(lifeStep(block, 4, 4), 1)).toEqual({
      kind: 'repeating',
      period: 1,
      since: 0,
    })

    const blinking = new LifeHistory()
    let grid = parse(['.....', '..3..', '..3..', '..3..', '.....'])
    blinking.record(grid, 0)
    grid = lifeStep(grid, 5, 5)
    blinking.record(grid, 1)
    grid = lifeStep(grid, 5, 5)
    expect(blinking.record(grid, 2)).toEqual({ kind: 'repeating', period: 2, since: 0 })

    const lone = parse(['....', '.1..', '....', '....'])
    expect(new LifeHistory().record(lifeStep(lone, 4, 4), 1)).toEqual({ kind: 'extinct' })
  })
})
