/**
 * Cellular-automaton engine shared by every view's Game of Life (F03.21, R-013). Pure and
 * deterministic; views supply a board (viz/life/board.ts), this file only steps it.
 *
 * - **Topologies:** `square` (cols × rows, wrapping round or with dead edges), `graph` (any lattice
 *   as compressed neighbour lists, e.g. the sunflower's Fibonacci neighbours) and `line` (1-D).
 * - **Rules:** Life-like B/S rules for square and graph boards (Conway B3/S23, HighLife B36/S23,
 *   the hexagonal B2/S34…) and Wolfram's elementary rules (30, 90, 110…) for lines.
 * - **Colour Life:** a cell keeps its digit's colour while it lives; a newborn takes the colour
 *   most of its parents share, else the middle one of three different digits (a deterministic
 *   take on the two-colour "Immigration" variant), so you can watch digit families spread.
 * - **Settling:** `LifeHistory` notices when the board has died out or repeats (still life,
 *   oscillator).
 */

/** −1 for a dead cell, otherwise the digit (colour index) of a living one. */
export type LifeGrid = Int8Array<ArrayBuffer>

export const DEAD = -1

export type Topology =
  | { kind: 'square'; cols: number; rows: number; wrap: boolean }
  /** Cell i's neighbours are `neighbours[offsets[i] … offsets[i + 1])` (CSR lists). */
  | { kind: 'graph'; cells: number; neighbours: Int32Array; offsets: Int32Array }
  | { kind: 'line'; cells: number; wrap: boolean }

export type LifeRule =
  /** Born with `birth` live neighbours, survives with `survive`; e.g. Conway B3/S23. */
  | { kind: 'life-like'; birth: readonly number[]; survive: readonly number[] }
  /** Wolfram code 0–255 for a line: the next cell from (left, self, right). */
  | { kind: 'elementary'; rule: number }

export const CONWAY: LifeRule = { kind: 'life-like', birth: [3], survive: [2, 3] }
/** Hexagonal Life (Callahan's B2/S34): the usual rule for a ~6-neighbour lattice. */
export const HEX_LIFE: LifeRule = { kind: 'life-like', birth: [2], survive: [3, 4] }

export const cellCount = (topology: Topology): number =>
  topology.kind === 'square' ? topology.cols * topology.rows : topology.cells

/** Parse "B3/S23" (also "b36/s23", "23/3" in the older S/B order is not accepted). */
export function parseLifeRule(text: string): LifeRule {
  const match = /^B(\d*)\/S(\d*)$/i.exec(text.trim())
  if (!match) throw new RangeError(`Not a Life-like rule: ${JSON.stringify(text)}`)
  const digits = (part: string) => [...new Set(part.split('').map(Number))].sort((a, b) => a - b)
  const birth = digits(match[1]!)
  const survive = digits(match[2]!)
  if ([...birth, ...survive].some((n) => n > 8)) {
    throw new RangeError(`A cell has at most 8 neighbours: ${JSON.stringify(text)}`)
  }
  return { kind: 'life-like', birth, survive }
}

export const formatLifeRule = (rule: LifeRule): string =>
  rule.kind === 'life-like'
    ? `B${rule.birth.join('')}/S${rule.survive.join('')}`
    : `Rule ${rule.rule}`

/** The colour two or three parents share, else the middle of three different digits. */
export function newbornColour(a: number, b: number, c: number): number {
  if (a === b || a === c) return a
  if (b === c) return b
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))
}

/** One generation of `grid` on `topology` under `rule`. */
export function step(grid: LifeGrid, topology: Topology, rule: LifeRule): LifeGrid {
  if (grid.length !== cellCount(topology)) {
    throw new RangeError(`Grid has ${grid.length} cells, the board ${cellCount(topology)}`)
  }
  if (topology.kind === 'line') {
    if (rule.kind !== 'elementary') throw new RangeError('A line needs an elementary rule')
    return stepLine(grid, topology, rule.rule)
  }
  if (rule.kind !== 'life-like') throw new RangeError('A grid needs a Life-like rule')
  return topology.kind === 'square'
    ? stepSquare(grid, topology, rule)
    : stepGraph(grid, topology, rule)
}

/** Birth / survival lookups indexed by the live-neighbour count (0–8). */
function tables(rule: Extract<LifeRule, { kind: 'life-like' }>) {
  const birth = new Uint8Array(9)
  const survive = new Uint8Array(9)
  for (const n of rule.birth) birth[n] = 1
  for (const n of rule.survive) survive[n] = 1
  return { birth, survive }
}

/**
 * Square fast path: the neighbour count of every cell comes from eight shifted passes over typed
 * arrays (no per-cell loops over neighbours), then one pass decides births and survivals. Newborn
 * colours need the parents, which only births look up.
 */
function stepSquare(
  grid: LifeGrid,
  { cols, rows, wrap }: Extract<Topology, { kind: 'square' }>,
  rule: Extract<LifeRule, { kind: 'life-like' }>,
): LifeGrid {
  const n = cols * rows
  const { birth, survive } = tables(rule)
  const alive = new Uint8Array(n)
  for (let i = 0; i < n; i++) alive[i] = grid[i] === DEAD ? 0 : 1
  const count = new Uint8Array(n)
  // Row offsets of the three source rows for each target row, −1 for "off the board".
  const rowAt = (y: number) => (y < 0 || y >= rows ? (wrap ? (y + rows) % rows : -1) : y)
  const colAt = (x: number) => (x < 0 || x >= cols ? (wrap ? (x + cols) % cols : -1) : x)
  for (let y = 0; y < rows; y++) {
    const target = y * cols
    for (let dy = -1; dy <= 1; dy++) {
      const sy = rowAt(y + dy)
      if (sy < 0) continue
      const source = sy * cols
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        // Interior cells: a straight shifted add; the two edge columns handled separately.
        const from = Math.max(0, -dx)
        const to = Math.min(cols, cols - dx)
        for (let x = from; x < to; x++)
          count[target + x] = count[target + x]! + alive[source + x + dx]!
        if (dx !== 0) {
          const edgeX = dx < 0 ? 0 : cols - 1
          const sx = colAt(edgeX + dx)
          if (sx >= 0) count[target + edgeX] = count[target + edgeX]! + alive[source + sx]!
        }
      }
    }
  }
  const next = new Int8Array(n).fill(DEAD)
  for (let i = 0; i < n; i++) {
    const c = count[i]!
    if (alive[i]) {
      if (survive[c]) next[i] = grid[i]!
    } else if (birth[c]) {
      next[i] = parentsColour(grid, i, cols, rows, wrap)
    }
  }
  return next
}

/** Colour for a cell born at `i` on a square board: from its (first three) live neighbours. */
function parentsColour(grid: LifeGrid, i: number, cols: number, rows: number, wrap: boolean) {
  const x = i % cols
  const y = (i - x) / cols
  const parents = [DEAD, DEAD, DEAD]
  let found = 0
  for (let dy = -1; dy <= 1 && found < 3; dy++) {
    let sy = y + dy
    if (sy < 0 || sy >= rows) {
      if (!wrap) continue
      sy = (sy + rows) % rows
    }
    for (let dx = -1; dx <= 1 && found < 3; dx++) {
      if (dx === 0 && dy === 0) continue
      let sx = x + dx
      if (sx < 0 || sx >= cols) {
        if (!wrap) continue
        sx = (sx + cols) % cols
      }
      const v = grid[sy * cols + sx]!
      if (v !== DEAD) parents[found++] = v
    }
  }
  return newbornColour(parents[0]!, parents[1]!, parents[2]!)
}

function stepGraph(
  grid: LifeGrid,
  { cells, neighbours, offsets }: Extract<Topology, { kind: 'graph' }>,
  rule: Extract<LifeRule, { kind: 'life-like' }>,
): LifeGrid {
  const { birth, survive } = tables(rule)
  const next = new Int8Array(cells).fill(DEAD)
  const parents = [DEAD, DEAD, DEAD]
  for (let i = 0; i < cells; i++) {
    let alive = 0
    for (let k = offsets[i]!; k < offsets[i + 1]!; k++) {
      const v = grid[neighbours[k]!]!
      if (v === DEAD) continue
      if (alive < 3) parents[alive] = v
      alive++
    }
    const c = Math.min(8, alive)
    if (grid[i] !== DEAD) {
      if (survive[c]) next[i] = grid[i]!
    } else if (birth[c]) {
      next[i] = newbornColour(parents[0]!, parents[1]!, parents[2]!)
    }
  }
  return next
}

/**
 * Elementary automaton: the next state of a cell is bit (left·4 + self·2 + right) of the rule
 * number. A newborn's colour is its live parents' colour (majority of up to three).
 */
function stepLine(
  grid: LifeGrid,
  { cells, wrap }: Extract<Topology, { kind: 'line' }>,
  rule: number,
): LifeGrid {
  if (!Number.isInteger(rule) || rule < 0 || rule > 255) throw new RangeError(`Bad rule ${rule}`)
  const next = new Int8Array(cells).fill(DEAD)
  const at = (i: number) => {
    if (i >= 0 && i < cells) return grid[i]!
    return wrap ? grid[(i + cells) % cells]! : DEAD
  }
  for (let i = 0; i < cells; i++) {
    const l = at(i - 1)
    const s = grid[i]!
    const r = at(i + 1)
    const pattern = (l === DEAD ? 0 : 4) + (s === DEAD ? 0 : 2) + (r === DEAD ? 0 : 1)
    if (!((rule >> pattern) & 1)) continue
    const parents = [l, s, r].filter((v) => v !== DEAD)
    next[i] =
      parents.length === 0
        ? 0 // born from nothing (rules with bit 0 set): the first colour
        : parents.length === 1
          ? parents[0]!
          : newbornColour(parents[0]!, parents[1]!, parents[2] ?? parents[0]!)
  }
  return next
}

/** A square grid as a graph topology (for tests and for views that mix lattices). */
export function squareAsGraph({
  cols,
  rows,
  wrap,
}: Extract<Topology, { kind: 'square' }>): Topology {
  const cells = cols * rows
  const offsets = new Int32Array(cells + 1)
  const lists: number[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          let sx = x + dx
          let sy = y + dy
          if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) {
            if (!wrap) continue
            sx = (sx + cols) % cols
            sy = (sy + rows) % rows
          }
          lists.push(sy * cols + sx)
        }
      }
      offsets[y * cols + x + 1] = lists.length
    }
  }
  return { kind: 'graph', cells, neighbours: Int32Array.from(lists), offsets }
}

export const population = (grid: LifeGrid) => grid.reduce((n, v) => (v === DEAD ? n : n + 1), 0)

/** How a run stands: still running, died out, or repeating with a period. */
export type LifeStatus =
  { kind: 'running' } | { kind: 'extinct' } | { kind: 'repeating'; period: number; since: number }

/** Remembers recent generations to tell when the game has settled (still life or oscillator). */
export class LifeHistory {
  private seen = new Map<string, number>()
  private order: string[] = []

  constructor(private readonly memory = 256) {}

  /** Record generation `generation`; returns how the run stands after it. */
  record(grid: LifeGrid, generation: number): LifeStatus {
    if (population(grid) === 0) return { kind: 'extinct' }
    const key = fingerprint(grid)
    const before = this.seen.get(key)
    if (before !== undefined)
      return { kind: 'repeating', period: generation - before, since: before }
    this.seen.set(key, generation)
    this.order.push(key)
    if (this.order.length > this.memory) this.seen.delete(this.order.shift()!)
    return { kind: 'running' }
  }
}

/** A compact exact key for a grid (cells as characters; colours count). */
function fingerprint(grid: LifeGrid): string {
  let key = ''
  for (let i = 0; i < grid.length; i += 4096) {
    key += String.fromCharCode(...Array.from(grid.subarray(i, i + 4096), (v) => v + 66))
  }
  return key
}
