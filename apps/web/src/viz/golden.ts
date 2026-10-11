/**
 * Golden rectangle (Fibonacci squares, F05.7 S05.7.2). Pure geometry, in grid cells; the renderer
 * only scales it to pixels.
 *
 * Squares of side 1, 1, 2, 3, 5, 8, … are laid one after another around the growing rectangle,
 * each against the side whose length equals it: right, top, left, bottom, right… After k squares
 * the rectangle is Fₖ × Fₖ₊₁ cells (one side alternates), and since 1² + 1² + 2² + … + Fₖ² =
 * Fₖ·Fₖ₊₁ the squares tile it exactly. A quarter circle in each square joins up into the golden
 * spiral (the Fibonacci approximation of the logarithmic spiral that grows by φ every quarter turn).
 *
 * Digits fill the cells square by square from the centre outwards, each square in reading order,
 * so digit 0 is the first unit square and the newest digits are on the outermost square.
 */

export interface GoldenSquare {
  /** Top-left cell and side, in cells (x right, y down; the first square is at 0, 0). */
  readonly x: number
  readonly y: number
  readonly side: number
  /** Index of its first cell in digit order. */
  readonly first: number
  /** Quarter-circle of the spiral: centre (a square corner), start and end point. */
  readonly arc: {
    readonly cx: number
    readonly cy: number
    readonly from: readonly [number, number]
    readonly to: readonly [number, number]
  }
}

export interface GoldenLayout {
  readonly squares: readonly GoldenSquare[]
  /** Bounding box of all squares, in cells. */
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
  /** Cells in the layout: Fₖ · Fₖ₊₁. */
  readonly cells: number
}

/** Fewest squares a layout uses (1 × 1, 1 × 2, 3 × 2, 3 × 5, 8 × 5: 40 cells). */
export const MIN_GOLDEN_SQUARES = 5

/** The layout of `k` squares (k ≥ 1). */
export function goldenLayout(k: number): GoldenLayout {
  if (!Number.isInteger(k) || k < 1) throw new RangeError(`Bad square count: ${k}`)
  const squares: GoldenSquare[] = []
  let [x0, y0, x1, y1] = [0, 0, 1, 1]
  let [a, b] = [1, 1] // sides of square i and i + 1
  let first = 0
  for (let i = 0; i < k; i++) {
    const side = a
    let x: number
    let y: number
    if (i === 0) [x, y] = [0, 0]
    else {
      switch (i % 4) {
        case 1: // right
          ;[x, y] = [x1, y0]
          break
        case 2: // top
          ;[x, y] = [x0, y0 - side]
          break
        case 3: // left
          ;[x, y] = [x0 - side, y0]
          break
        default:
          // bottom
          ;[x, y] = [x0, y1]
      }
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x + side)
      y1 = Math.max(y1, y + side)
    }
    squares.push({ x, y, side, first, arc: quarterArc(i % 4, x, y, side) })
    first += side * side
    ;[a, b] = [b, a + b]
  }
  return { squares, minX: x0, minY: y0, width: x1 - x0, height: y1 - y0, cells: first }
}

/**
 * The quarter circle through a square, so that consecutive ones join: square 0 and every 4th one
 * after it bend about their top-right corner, then top-left, bottom-left, bottom-right in turn.
 */
function quarterArc(turn: number, x: number, y: number, s: number): GoldenSquare['arc'] {
  switch (turn) {
    case 1: // right: centre top-left, from bottom-left to top-right
      return { cx: x, cy: y, from: [x, y + s], to: [x + s, y] }
    case 2: // top: centre bottom-left, from bottom-right to top-left
      return { cx: x, cy: y + s, from: [x + s, y + s], to: [x, y] }
    case 3: // left: centre bottom-right, from top-right to bottom-left
      return { cx: x + s, cy: y + s, from: [x + s, y], to: [x, y + s] }
    default: // first / bottom: centre top-right, from top-left to bottom-right
      return { cx: x + s, cy: y, from: [x, y], to: [x + s, y + s] }
  }
}

/** Fewest squares (at least MIN_GOLDEN_SQUARES) whose rectangle holds `count` digits. */
export function goldenSquaresFor(count: number): number {
  let k = MIN_GOLDEN_SQUARES
  let [a, b] = [5, 8] // F₅ · F₆ = 40 cells for k = 5
  while (a * b < count) {
    ;[a, b] = [b, a + b]
    k++
  }
  return k
}

/** The cell (x, y, in cells) of digit `index` in a layout, or null past its last cell. */
export function goldenCell(layout: GoldenLayout, index: number): [number, number] | null {
  if (!Number.isInteger(index) || index < 0 || index >= layout.cells) return null
  // Binary search for the square holding this index.
  const { squares } = layout
  let lo = 0
  let hi = squares.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (squares[mid]!.first <= index) lo = mid
    else hi = mid - 1
  }
  const square = squares[lo]!
  const k = index - square.first
  return [square.x + (k % square.side), square.y + Math.floor(k / square.side)]
}
