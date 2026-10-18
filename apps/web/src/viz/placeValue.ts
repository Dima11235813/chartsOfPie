import type { DigitSource } from '../core/digits/digitSource'

/**
 * Place-value wall (R-013 L2). Pure layout, in grid cells; the renderer only scales it to pixels.
 *
 * Each row is one number of a whole-number sequence, right-aligned so that digits of equal place
 * value (units, tens or twelves, hundreds or gross …) stand in one column. For Fibonacci the
 * right-hand columns then show the Pisano loops (the units column of the base-12 reading repeats
 * every 24 rows, and so do the two columns beside it); the left edge is a straight staircase,
 * since each term is log_b φ digits longer than the last (0.209 in base 10, 0.194 in base 12);
 * and the first column follows Benford's law.
 *
 * Numbers without terms (constants, or a one-symbol-per-term loop) are laid out as a triangle
 * instead: row r holds r + 1 digits, so every row is one digit longer than the one above.
 */
export interface WallLayout {
  /** `terms`: one row per number of the sequence; `triangle`: row r holds r + 1 digits. */
  readonly kind: 'terms' | 'triangle'
  /** Row of symbol i of the performance (0 = the first row). */
  row(i: number): number
  /** Place of symbol i counted from the right: 0 = the units place. */
  place(i: number): number
}

/** Row r of the triangle starts at symbol r(r + 1)/2. */
export const triangleRow = (i: number) => Math.floor((Math.sqrt(8 * i + 1) - 1) / 2)

export const TRIANGLE_LAYOUT: WallLayout = {
  kind: 'triangle',
  row: triangleRow,
  place: (i) => {
    const r = triangleRow(i)
    return (r * (r + 1)) / 2 + r - i
  },
}

/**
 * The wall for a source: one row per term for a sequence written out digit by digit (Fibonacci
 * all digits, base 12), the triangle otherwise. A source that starts part-way in (`offset`) keeps
 * every digit in its true place, so a first row that starts mid-number is missing its left end.
 */
export function wallLayoutFor(
  source: Pick<DigitSource, 'terms' | 'period' | 'offset'>,
): WallLayout {
  const { terms, period } = source
  if (!terms || period) return TRIANGLE_LAYOUT
  const offset = source.offset ?? 0
  const firstTerm = terms.termAt(offset)
  return {
    kind: 'terms',
    row: (i) => terms.termAt(offset + i) - firstTerm,
    place: (i) => {
      const at = offset + i
      return terms.startOf(terms.termAt(at) + 1) - 1 - at
    },
  }
}

/** Rows and widest row (in cells) of the first `count` symbols. */
export function wallExtent(layout: WallLayout, count: number): { rows: number; width: number } {
  if (count <= 0) return { rows: 0, width: 0 }
  const rows = layout.row(count - 1) + 1
  if (layout.kind === 'triangle') return { rows, width: rows }
  // A row is as wide as its first digit's place + 1; check the first digit drawn of each row.
  let width = 0
  for (let i = 0; i < count;) {
    const r = layout.row(i)
    width = Math.max(width, layout.place(i) + 1)
    // Skip to the next row: the rest of this one has smaller places.
    i += layout.place(i) + 1
    if (layout.row(i) === r) i++ // never stall on a malformed layout
  }
  return { rows, width }
}

/** The largest square cell (≤ `max`) that fits `rows` × `width` cells in a `w` × `h` frame. */
export const wallCell = (w: number, h: number, rows: number, width: number, max: number) =>
  Math.min(max, w / Math.max(1, width), h / Math.max(1, rows))
