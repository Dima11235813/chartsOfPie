import { mosaicGroupSizes } from './art'
import { CONWAY, DEAD, step, type LifeGrid } from './life/engine'
import { mosaicGroups } from './mosaicShapes'

// The engine (rules, topologies, colour Life, settling) lives in life/engine.ts (F03.21); this
// file keeps the mosaic's seed and the names the mosaic's view uses.
export {
  DEAD,
  LifeHistory,
  newbornColour,
  population,
  type LifeGrid,
  type LifeStatus,
} from './life/engine'

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

/** One generation (B3/S23) on a torus of `cols` × `rows`: the shared engine on a square board. */
export function lifeStep(grid: LifeGrid, cols: number, rows: number): LifeGrid {
  return step(grid, { kind: 'square', cols, rows, wrap: true }, CONWAY)
}
