/**
 * Shapes of mosaic groups. A group of equal neighbours in the neighbour mosaic is a set of grid
 * cells joined edge-to-edge or corner-to-corner — a **polyplet** (also "polyking"). Two groups have
 * the same *fixed* shape if one is a translation of the other, and the same *free* shape if it is
 * a rotation/reflection too. Known counts (OEIS): fixed A006770 = 1, 4, 20, 110, 638 …;
 * free A030222 = 1, 2, 5, 22, 94 … for 1–5 cells (verified by enumeration in the tests).
 */

export type Cell = readonly [x: number, y: number]

/** Translate so the smallest x and y are 0, and list cells in a fixed order. */
function normalise(cells: readonly Cell[]): Cell[] {
  let minX = Infinity
  let minY = Infinity
  for (const [x, y] of cells) {
    if (x < minX) minX = x
    if (y < minY) minY = y
  }
  return cells
    .map(([x, y]) => [x - minX, y - minY] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

const keyOf = (cells: readonly Cell[]) => cells.map(([x, y]) => `${x},${y}`).join(';')

/** Same shape up to translation (orientation matters: in the mosaic, rows are digit order). */
export function fixedKey(cells: readonly Cell[]): string {
  return keyOf(normalise(cells))
}

/** The 8 symmetries of the square (rotations and reflections). */
const SYMMETRIES: readonly ((c: Cell) => Cell)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [x, -y],
  ([x, y]) => [y, x],
  ([x, y]) => [-y, -x],
]

/** Same shape up to rotation and reflection: the smallest fixed key over the 8 symmetries. */
export function freeKey(cells: readonly Cell[]): string {
  let best: string | null = null
  for (const transform of SYMMETRIES) {
    const key = fixedKey(cells.map(transform))
    if (best === null || key < best) best = key
  }
  return best!
}

/** Cells of a key (as produced by `fixedKey`/`freeKey`). */
export function cellsOfKey(key: string): Cell[] {
  return key.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return [x!, y!] as const
  })
}

const KING_STEPS: readonly Cell[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/** Every fixed polyplet with `size` cells, as fixed keys (grown cell by cell, deduplicated). */
export function enumeratePolyplets(size: number): Set<string> {
  let level = new Set<string>([fixedKey([[0, 0]])])
  for (let n = 2; n <= size; n++) {
    const next = new Set<string>()
    for (const key of level) {
      const cells = cellsOfKey(key)
      const taken = new Set(cells.map(([x, y]) => `${x},${y}`))
      for (const [x, y] of cells) {
        for (const [dx, dy] of KING_STEPS) {
          const cell: Cell = [x + dx, y + dy]
          if (taken.has(`${cell[0]},${cell[1]}`)) continue
          next.add(fixedKey([...cells, cell]))
        }
      }
    }
    level = next
  }
  return level
}

/** How many free shapes exist with `size` cells (for "found 17 of 22"). */
export const FREE_POLYPLET_COUNTS: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 5,
  4: 22,
  5: 94,
}

/** The two most enclosed 5-cell shapes — the rarest in π (R-009). */
const PLUS = freeKey([
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 2],
])
const CROSS = freeKey([
  [0, 0],
  [2, 0],
  [1, 1],
  [0, 2],
  [2, 2],
])

/** A short everyday name for the small shapes people will meet most. */
export function shapeName(key: string): string | null {
  const cells = cellsOfKey(key)
  const width = Math.max(...cells.map(([x]) => x)) + 1
  const height = Math.max(...cells.map(([, y]) => y)) + 1
  const n = cells.length
  if (height === 1 || width === 1) return n === 2 ? 'pair' : `line of ${n}`
  if (n === 2) return 'diagonal pair'
  if (n === 4 && width === 2 && height === 2) return 'square'
  if (key === PLUS) return 'plus'
  if (key === CROSS) return 'X'
  const diagonal = cells.every(([x, y]) => x === y) || cells.every(([x, y]) => x + y === width - 1)
  if (diagonal) return `diagonal of ${n}`
  return null
}
