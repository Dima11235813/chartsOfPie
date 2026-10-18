import { mosaicGroupSizes } from './art'
import { mosaicGroups } from './mosaicShapes'

/**
 * Conway's Game of Life seeded from the neighbour mosaic (F03.4, owner idea 2026-10-18). Pure and
 * deterministic; the view only draws it.
 *
 * - The grid is the mosaic as shown: its columns and its visible rows, wrapping round at the edges
 *   (a torus), so nothing piles up against a wall and gliders travel forever.
 * - The seed is what the mosaic shows: a dot is alive if it is linked to equal neighbours, in a
 *   group at least as big as the "Show" filter asks (2+ when showing every digit), or, when a
 *   shape is picked in the census, in a group of that shape.
 * - Colour Life: a cell keeps its digit's colour while it lives; a newborn takes the colour most
 *   of its three parents share, or the middle one of three different digits (a deterministic
 *   take on the two-colour "Immigration" variant), so you can watch digit families spread.
 */

/** −1 for a dead cell, otherwise the digit (colour) of a living one. */
export type LifeGrid = Int8Array<ArrayBuffer>

export const DEAD = -1

export interface LifeSeedOptions {
  /** Columns of the mosaic. */
  cols: number
  /** Rows of the grid (the mosaic's visible rows). */
  rows: number
  /** Digits of the visible window, from the first cell of the top row; fewer than rows × cols
   * when the last row is not full (missing cells are dead). */
  digits: ArrayLike<number>
  /** Absolute index of `digits[0]` (keeps groups aligned with what the mosaic drew). */
  first: number
  /** The mosaic's groups filter: 0 or 1 = every digit (alive if linked), else group size ≥ it. */
  minGroup: number
  /** A free shape picked in the shape census: only groups of that shape are alive. */
  shape?: string | null
}

/** The first generation: the mosaic's linked dots, as filtered on screen. */
export function lifeSeed({
  cols,
  rows,
  digits,
  first,
  minGroup,
  shape,
}: LifeSeedOptions): LifeGrid {
  const grid = new Int8Array(cols * rows).fill(DEAD)
  const n = Math.min(digits.length, cols * rows)
  const window = Array.from({ length: n }, (_, k) => digits[k]!)
  if (shape) {
    for (const group of mosaicGroups(window, cols, first, 2, 9)) {
      if (group.shape !== shape) continue
      for (const i of group.indices) grid[i - first] = window[i - first]!
    }
    return grid
  }
  const least = Math.max(2, minGroup)
  const sizes = mosaicGroupSizes(window, cols, first)
  for (let k = 0; k < n; k++) if (sizes[k]! >= least) grid[k] = window[k]!
  return grid
}

/** One generation (B3/S23) on a torus of `cols` × `rows`. */
export function lifeStep(grid: LifeGrid, cols: number, rows: number): LifeGrid {
  const next = new Int8Array(grid.length).fill(DEAD)
  const parents = [0, 0, 0]
  for (let y = 0; y < rows; y++) {
    const up = ((y + rows - 1) % rows) * cols
    const row = y * cols
    const down = ((y + 1) % rows) * cols
    for (let x = 0; x < cols; x++) {
      const left = (x + cols - 1) % cols
      const right = (x + 1) % cols
      let alive = 0
      for (const r of [up, row, down]) {
        for (const c of [left, x, right]) {
          if (r === row && c === x) continue
          const value = grid[r + c]!
          if (value === DEAD) continue
          if (alive < 3) parents[alive] = value
          alive++
        }
      }
      const self = grid[row + x]!
      if (self !== DEAD) {
        if (alive === 2 || alive === 3) next[row + x] = self
      } else if (alive === 3) {
        next[row + x] = newbornColour(parents[0]!, parents[1]!, parents[2]!)
      }
    }
  }
  return next
}

/** The colour two or three parents share, else the middle of three different digits. */
export function newbornColour(a: number, b: number, c: number): number {
  if (a === b || a === c) return a
  if (b === c) return b
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))
}

export const population = (grid: LifeGrid) => grid.reduce((n, v) => (v === DEAD ? n : n + 1), 0)

/** How a run ended: still running, died out, or repeating with a period. */
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
