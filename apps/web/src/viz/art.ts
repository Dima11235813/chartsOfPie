/**
 * Geometry for the artistic views (see proj-mgmt/research/R-006). Pure and unit-tested; the canvas
 * components only draw what these functions compute.
 */

const TAU = Math.PI * 2

/** 1/φ — successive multiples mod 1 spread points evenly and never need re-spacing. */
export const GOLDEN_RATIO_CONJUGATE = (Math.sqrt(5) - 1) / 2
/** The golden angle, 360°·(1 − 1/φ) ≈ 137.508°, in radians. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// ── π walk (Nadieh Bremer, "The Art in Pi") ────────────────────────────────────────────────────

/** Unit step for a digit: ten directions, 0 pointing up, increasing clockwise (36° apart). */
export function walkStep(digit: number): [number, number] {
  const angle = (digit / 10) * TAU
  return [Math.sin(angle), -Math.cos(angle)]
}

/** Growing walk path with its bounding box; arrays grow by doubling. */
export class WalkPath {
  xs = new Float64Array(1024)
  ys = new Float64Array(1024)
  length = 1 // starts with the origin
  minX = 0
  maxX = 0
  minY = 0
  maxY = 0

  push(digit: number): void {
    if (this.length === this.xs.length) {
      const grow = (old: Float64Array) => {
        const next = new Float64Array(old.length * 2)
        next.set(old)
        return next
      }
      this.xs = grow(this.xs)
      this.ys = grow(this.ys)
    }
    const [dx, dy] = walkStep(digit)
    const x = this.xs[this.length - 1]! + dx
    const y = this.ys[this.length - 1]! + dy
    this.xs[this.length] = x
    this.ys[this.length] = y
    this.length += 1
    this.minX = Math.min(this.minX, x)
    this.maxX = Math.max(this.maxX, x)
    this.minY = Math.min(this.minY, y)
    this.maxY = Math.max(this.maxY, y)
  }
}

export interface FitTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/** Scale and offset that fit a bounding box (with a margin factor ≥ 1) into width × height. */
export function fitBounds(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  width: number,
  height: number,
  margin = 1.25,
): FitTransform {
  const spanX = Math.max(maxX - minX, 10) * margin
  const spanY = Math.max(maxY - minY, 10) * margin
  const scale = Math.min(width / spanX, height / spanY)
  return {
    scale,
    offsetX: width / 2 - ((minX + maxX) / 2) * scale,
    offsetY: height / 2 - ((minY + maxY) / 2) * scale,
  }
}

// ── Sunflower (Vogel's phyllotaxis model) ─────────────────────────────────────────────────────

/** Position of seed n: r = spacing·√n, θ = n × golden angle (Vogel, 1979). */
export function seedPosition(n: number, spacing: number): [number, number] {
  const r = spacing * Math.sqrt(n)
  const theta = n * GOLDEN_ANGLE
  return [r * Math.cos(theta), r * Math.sin(theta)]
}

/** Seeds the canvas is laid out for: grows ×4 so rescaling (a full redraw) is rare. */
export function sunflowerCapacity(count: number): number {
  let capacity = 400
  while (capacity < count) capacity *= 4
  return capacity
}

// ── Digit ring (Cristian Ilies Vasile / Martin Krzywinski) ────────────────────────────────────

/** Gap between digit segments, radians. */
export const RING_GAP = 0.06

/** Angular extent [start, end] of a digit's segment; 0 starts at the top, clockwise. */
export function ringSegment(digit: number): [number, number] {
  const width = TAU / 10
  const start = -Math.PI / 2 + digit * width + RING_GAP / 2
  return [start, start + width - RING_GAP]
}

/**
 * Where on its segment a link endpoint sits: the k-th occurrence of a digit lands at
 * frac(k / φ) along the segment, which spreads endpoints evenly without ever moving old ones.
 */
export function ringAngle(digit: number, occurrence: number): number {
  const [start, end] = ringSegment(digit)
  const t = (occurrence * GOLDEN_RATIO_CONJUGATE) % 1
  return start + t * (end - start)
}

/** Point on a circle of radius r around the origin. */
export const polar = (angle: number, r: number): [number, number] => [
  r * Math.cos(angle),
  r * Math.sin(angle),
]

/** Counts of digit → next-digit transitions (10 × 10). */
export class TransitionCounts {
  readonly counts = new Uint32Array(100)
  max = 0

  add(from: number, to: number): number {
    const value = ++this.counts[from * 10 + to]!
    this.max = Math.max(this.max, value)
    return value
  }

  get(from: number, to: number): number {
    return this.counts[from * 10 + to]!
  }

  reset(): void {
    this.counts.fill(0)
    this.max = 0
  }
}

// ── Neighbour mosaic (our third inspiration image) ─────────────────────────────────────────────

/**
 * Earlier cells adjacent to cell `index` in a row-major grid with `cols` columns: left, up-left,
 * up and up-right. Linking a new dot to equal earlier neighbours draws every equal-neighbour link
 * exactly once.
 */
export function earlierNeighbours(index: number, cols: number): number[] {
  const col = index % cols
  const neighbours: number[] = []
  if (col > 0) neighbours.push(index - 1)
  if (index >= cols) {
    if (col > 0) neighbours.push(index - cols - 1)
    neighbours.push(index - cols)
    if (col < cols - 1) neighbours.push(index - cols + 1)
  }
  return neighbours
}

// ── Times-table string art (modular multiplication on a circle) ────────────────────────────────

/** Multiplier chosen by the two latest digits: 2 + d₁ + d₂/10, i.e. 2.0 … 11.9. */
export function stringArtMultiplier(previousDigit: number, digit: number): number {
  return 2 + previousDigit + digit / 10
}

/** End point (as a fractional point index) of the chord from point n: k·n mod N. */
export function stringArtTarget(n: number, multiplier: number, points: number): number {
  return (n * multiplier) % points
}

/** Angle of a (fractional) point index on a circle of N points, 0 at the top, clockwise. */
export function circlePointAngle(index: number, points: number): number {
  return -Math.PI / 2 + (index / points) * TAU
}

// ── Music clock ────────────────────────────────────────────────────────────────────────────────

export type ClockOrder = 'chromatic' | 'fifths'

/**
 * Position (0–11, clockwise from the top) of a pitch class on the clock. Chromatic order steps by
 * semitones; the circle of fifths steps by 7 semitones (C G D A E B F♯ C♯ G♯ D♯ A♯ F), which puts
 * notes of the same key next to each other.
 */
export function clockPosition(pitchClass: number, order: ClockOrder): number {
  const pc = ((pitchClass % 12) + 12) % 12
  return order === 'chromatic' ? pc : (pc * 7) % 12
}

export const clockAngle = (pitchClass: number, order: ClockOrder) =>
  -Math.PI / 2 + (clockPosition(pitchClass, order) / 12) * TAU
