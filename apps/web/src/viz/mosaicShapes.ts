import { earlierNeighbours } from './art'
import { fixedKey, freeKey, type Cell } from './polyplets'

/** One group of equal neighbours in the mosaic, with its shape. */
export interface MosaicGroup {
  digit: number
  /** Absolute digit indices in the group, ascending. */
  indices: number[]
  /** Free shape (up to rotation/reflection) — the census key. */
  shape: string
  /** Shape as laid out (orientation matters: across = consecutive digits). */
  fixed: string
}

/** Grid cell of absolute index `i` with `cols` columns. */
export const cellOf = (i: number, cols: number): Cell => [i % cols, Math.floor(i / cols)]

/**
 * All groups of `minSize`–`maxSize` equal neighbours among `digits` (cell `first + k` holds
 * `digits[k]`) laid out in `cols` columns. Same 8-way links the mosaic draws.
 */
export function mosaicGroups(
  digits: ArrayLike<number>,
  cols: number,
  first = 0,
  minSize = 2,
  maxSize = 5,
): MosaicGroup[] {
  const n = digits.length
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  for (let k = 0; k < n; k++) {
    for (const j of earlierNeighbours(first + k, cols)) {
      const jk = j - first
      if (jk < 0 || digits[jk] !== digits[k]) continue
      const a = find(k)
      const b = find(jk)
      if (a !== b) parent[a] = b
    }
  }
  const members = new Map<number, number[]>()
  for (let k = 0; k < n; k++) {
    const root = find(k)
    const list = members.get(root)
    if (list) list.push(first + k)
    else members.set(root, [first + k])
  }
  const groups: MosaicGroup[] = []
  for (const indices of members.values()) {
    if (indices.length < minSize || indices.length > maxSize) continue
    const cells = indices.map((i) => cellOf(i, cols))
    groups.push({
      digit: digits[indices[0]! - first]!,
      indices,
      shape: freeKey(cells),
      fixed: fixedKey(cells),
    })
  }
  return groups
}

export interface ShapeCount {
  shape: string
  size: number
  count: number
}

/** How often each free shape occurs, most common first (ties: smaller, then by key). */
export function shapeCensus(groups: readonly MosaicGroup[]): ShapeCount[] {
  const counts = new Map<string, ShapeCount>()
  for (const group of groups) {
    const entry = counts.get(group.shape)
    if (entry) entry.count++
    else counts.set(group.shape, { shape: group.shape, size: group.indices.length, count: 1 })
  }
  return [...counts.values()].sort(
    (a, b) => a.size - b.size || b.count - a.count || a.shape.localeCompare(b.shape),
  )
}

/** Fixed geometry for a whole sweep, so dots glide between widths instead of jumping. */
export interface SweepFrame {
  cell: number
  /** How many of the most recent digits are on show. */
  window: number
  left: number
  top: number
  innerWidth: number
}

/**
 * One cell size for every width from `low` to `high` columns: `high` columns fit the width, and
 * as many recent digits are shown as fill the frame at `low` columns.
 */
export function sweepFrame(
  width: number,
  height: number,
  scale: number,
  low: number,
  high: number,
  played: number,
): SweepFrame {
  const pad = 10 * scale
  const innerWidth = width - 2 * pad
  const innerHeight = height - 2 * pad
  const cell = Math.max(2.5 * scale, Math.min(30 * scale, innerWidth / high))
  const rows = Math.max(1, Math.floor(innerHeight / cell))
  return { cell, window: Math.min(played, low * rows), left: pad, top: pad, innerWidth }
}

/** Centre of digit `i` in a `cols`-column layout whose first shown digit is `start`. */
export function sweepTarget(frame: SweepFrame, cols: number, start: number, i: number): Cell {
  const { cell, left, top, innerWidth } = frame
  const x0 = left + (innerWidth - cols * cell) / 2
  const row = Math.floor(i / cols) - Math.floor(start / cols)
  return [x0 + (i % cols) * cell + cell / 2, top + row * cell + cell / 2]
}

/**
 * Exponential smoothing step: move `from` towards `to` so that after `tau` seconds 63 % of the
 * gap is closed, independent of the frame rate.
 */
export const approach = (from: number, to: number, dt: number, tau: number) =>
  from + (to - from) * (1 - Math.exp(-dt / tau))
