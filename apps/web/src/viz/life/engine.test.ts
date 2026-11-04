import { describe, expect, it } from 'vitest'
import {
  CONWAY,
  DEAD,
  formatLifeRule,
  HEX_LIFE,
  LifeHistory,
  parseLifeRule,
  population,
  squareAsGraph,
  step,
  type LifeGrid,
  type Topology,
} from './engine'

const parse = (rows: string[]): LifeGrid =>
  Int8Array.from(rows.join(''), (ch) => (ch === '.' ? DEAD : Number(ch)))
const show = (grid: LifeGrid, cols: number) =>
  Array.from({ length: grid.length / cols }, (_, y) =>
    Array.from(grid.subarray(y * cols, (y + 1) * cols), (v) => (v === DEAD ? '.' : String(v))).join(
      '',
    ),
  )
const square = (
  cols: number,
  rows: number,
  wrap = true,
): Extract<Topology, { kind: 'square' }> => ({
  kind: 'square',
  cols,
  rows,
  wrap,
})

describe('square boards', () => {
  it('block, blinker and a glider round an 8 × 8 torus in 32 generations', () => {
    const block = ['......', '.11...', '.11...', '......']
    expect(show(step(parse(block), square(6, 4), CONWAY), 6)).toEqual(block)
    const blinker = ['.....', '..3..', '..3..', '..3..', '.....']
    const once = step(parse(blinker), square(5, 5), CONWAY)
    expect(show(once, 5)).toEqual(['.....', '.....', '.333.', '.....', '.....'])
    expect(show(step(once, square(5, 5), CONWAY), 5)).toEqual(blinker)
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
      grid = step(grid, square(8, 8), CONWAY)
      expect(population(grid)).toBe(5)
    }
    expect(show(grid, 8)).toEqual(glider)
  })

  it('with dead edges a glider breaks up at the wall', () => {
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
    for (let g = 0; g < 32; g++) grid = step(grid, square(8, 8, false), CONWAY)
    expect(show(grid, 8)).not.toEqual(glider)
    // What is left is a still life or oscillator, never the travelling glider (5 cells moving).
    const after = step(grid, square(8, 8, false), CONWAY)
    const again = step(after, square(8, 8, false), CONWAY)
    expect(show(again, 8)).toEqual(show(grid, 8))
  })

  it('newborns take the parents’ majority colour, else the middle digit', () => {
    const mixed = ['.....', '..1..', '..5..', '..9..', '.....']
    expect(show(step(parse(mixed), square(5, 5), CONWAY), 5)[2]).toBe('.555.')
    const shared = ['.....', '..4..', '..4..', '..9..', '.....']
    expect(show(step(parse(shared), square(5, 5), CONWAY), 5)[2]).toBe('.444.')
  })

  it('HighLife (B36/S23): a replicator is born from six neighbours', () => {
    // A cell with exactly six live neighbours is born under B36 and not under B3.
    const six = ['111', '1.1', '1..']
    expect(step(parse(six), square(3, 3, false), CONWAY)[4]).toBe(DEAD)
    expect(step(parse(six), square(3, 3, false), parseLifeRule('B36/S23'))[4]).toBe(1)
  })
})

describe('graph boards', () => {
  it('a graph built from a square grid gives the same generations as the square fast path', () => {
    let seed = 12345
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (const wrap of [true, false]) {
      const topology = square(13, 9, wrap)
      const graph = squareAsGraph(topology)
      let a = Int8Array.from({ length: 13 * 9 }, () =>
        random() < 0.4 ? Math.floor(random() * 10) : DEAD,
      ) as LifeGrid
      let b = a
      for (let g = 0; g < 20; g++) {
        a = step(a, topology, CONWAY)
        b = step(b, graph, CONWAY)
        expect(Array.from(b)).toEqual(Array.from(a))
      }
    }
  })

  it('a hexagonal rule (B2/S34) on a small lattice differs from Conway as the rule says', () => {
    // K4 (every cell adjacent to every other) with three cells alive: each live cell has 2 live
    // neighbours, the dead one has 3. Conway: the live ones survive (2), the dead one is born
    // (3). B2/S34: the live ones die (need 3–4), the dead one is not born (needs exactly 2).
    const neighbours = Int32Array.from([1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2])
    const offsets = Int32Array.from([0, 3, 6, 9, 12])
    const k4: Topology = { kind: 'graph', cells: 4, neighbours, offsets }
    const grid = Int8Array.from([5, 5, 5, DEAD]) as LifeGrid
    expect(Array.from(step(grid, k4, CONWAY))).toEqual([5, 5, 5, 5])
    expect(Array.from(step(grid, k4, HEX_LIFE))).toEqual([DEAD, DEAD, DEAD, DEAD])
    // Two alive: the dead cells have 2 live neighbours each → born under B2, not under B3.
    const two = Int8Array.from([7, 7, DEAD, DEAD]) as LifeGrid
    expect(Array.from(step(two, k4, HEX_LIFE))).toEqual([DEAD, DEAD, 7, 7])
  })
})

describe('line boards (elementary automata)', () => {
  const line = (cells: number, wrap = false): Topology => ({ kind: 'line', cells, wrap })
  const rows = (rule: number, n: number, width = 15) => {
    let grid = new Int8Array(width).fill(DEAD) as LifeGrid
    grid[Math.floor(width / 2)] = 1
    const out = [show(grid, width)[0]!]
    for (let i = 1; i < n; i++) {
      grid = step(grid, line(width), { kind: 'elementary', rule })
      out.push(show(grid, width)[0]!)
    }
    return out.map((r) => r.replace(/1/g, '#'))
  }

  it('rule 90 draws Sierpiński’s triangle', () => {
    expect(rows(90, 5)).toEqual([
      '.......#.......',
      '......#.#......',
      '.....#...#.....',
      '....#.#.#.#....',
      '...#.......#...',
    ])
  })

  it('rule 30 and rule 110 match Wolfram’s first rows', () => {
    expect(rows(30, 5)).toEqual([
      '.......#.......',
      '......###......',
      '.....##..#.....',
      '....##.####....',
      '...##..#...#...',
    ])
    expect(rows(110, 5)).toEqual([
      '.......#.......',
      '......##.......',
      '.....###.......',
      '....##.#.......',
      '...#####.......',
    ])
  })

  it('wrapping joins the ends; a bad rule is rejected', () => {
    const grid = Int8Array.from([2, DEAD, DEAD, DEAD]) as LifeGrid
    // Rule 2 (00000010): only (l,s,r) = (0,0,1) gives a live cell: the cell left of a live one.
    expect(Array.from(step(grid, line(4, true), { kind: 'elementary', rule: 2 }))).toEqual([
      DEAD,
      DEAD,
      DEAD,
      2,
    ])
    expect(Array.from(step(grid, line(4, false), { kind: 'elementary', rule: 2 }))).toEqual([
      DEAD,
      DEAD,
      DEAD,
      DEAD,
    ])
    expect(() => step(grid, line(4), { kind: 'elementary', rule: 256 })).toThrow(RangeError)
    expect(() => step(grid, line(4), CONWAY)).toThrow(RangeError)
  })
})

describe('rules', () => {
  it('parses and formats B/S strings, rejecting bad ones', () => {
    expect(parseLifeRule('B3/S23')).toEqual(CONWAY)
    expect(parseLifeRule('b36/s23')).toEqual({ kind: 'life-like', birth: [3, 6], survive: [2, 3] })
    expect(formatLifeRule(parseLifeRule('B2/S34'))).toBe('B2/S34')
    expect(formatLifeRule({ kind: 'elementary', rule: 30 })).toBe('Rule 30')
    for (const bad of ['23/3', 'B9/S2', 'S23', ''])
      expect(() => parseLifeRule(bad)).toThrow(RangeError)
  })
})

describe('settling', () => {
  it('finds a still life, an oscillator and extinction', () => {
    const block = parse(['....', '.11.', '.11.', '....'])
    const still = new LifeHistory()
    expect(still.record(block, 0)).toEqual({ kind: 'running' })
    expect(still.record(step(block, square(4, 4), CONWAY), 1)).toEqual({
      kind: 'repeating',
      period: 1,
      since: 0,
    })
    const lone = parse(['....', '.1..', '....', '....'])
    expect(new LifeHistory().record(step(lone, square(4, 4), CONWAY), 1)).toEqual({
      kind: 'extinct',
    })
  })
})
