/**
 * Chladni figures (cymatics): sand on a vibrating square plate gathers on the nodal lines, where
 * the plate stays still. For a free square plate the classic approximation of mode (n, m) is
 *
 *   f(x, y) = cos(nπx)·cos(mπy) − cos(mπx)·cos(nπy),   x, y ∈ [0, 1]
 *
 * and its frequency grows with n² + m². Higher notes → higher modes → finer figures.
 */

export type Mode = readonly [number, number]

/** Distinct modes (n < m) ordered by n² + m², i.e. roughly by pitch. */
export const MODES: readonly Mode[] = (() => {
  const modes: Mode[] = []
  for (let n = 1; n <= 9; n++) for (let m = n + 1; m <= 10; m++) modes.push([n, m])
  return modes.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[0] - b[0])
})()

/** Mode for a note: semitones above the lowest note pick ever finer figures. */
export function modeForMidi(midi: number, lowestMidi: number): Mode {
  const index = Math.min(MODES.length - 1, Math.max(0, Math.round(midi - lowestMidi)))
  return MODES[index]!
}

/** Plate displacement at (x, y) for one mode. */
export function displacement(x: number, y: number, [n, m]: Mode): number {
  const px = Math.PI * x
  const py = Math.PI * y
  return Math.cos(n * px) * Math.cos(m * py) - Math.cos(m * px) * Math.cos(n * py)
}

/** Several notes at once: the plate vibrates in the sum of their modes. */
export function chordDisplacement(x: number, y: number, modes: readonly Mode[]): number {
  let sum = 0
  for (const mode of modes) sum += displacement(x, y, mode)
  return modes.length ? sum / modes.length : 0
}

/** ∂f/∂x and ∂f/∂y of one mode. */
export function gradient(x: number, y: number, [n, m]: Mode): [number, number] {
  const px = Math.PI * x
  const py = Math.PI * y
  const gx =
    -n * Math.PI * Math.sin(n * px) * Math.cos(m * py) +
    m * Math.PI * Math.sin(m * px) * Math.cos(n * py)
  const gy =
    -m * Math.PI * Math.cos(n * px) * Math.sin(m * py) +
    n * Math.PI * Math.cos(m * px) * Math.sin(n * py)
  return [gx, gy]
}

/** Plate displacement and gradient tabulated on a grid (no trig per grain per frame). */
export interface PlateField {
  /** Samples per side (the grid spans 0…1 inclusive). */
  readonly size: number
  readonly f: Float32Array
  readonly gx: Float32Array
  readonly gy: Float32Array
}

const FIELD_SIZE = 257
const fieldCache = new Map<string, PlateField>()

/** The tabulated field of a mode, computed once and cached (there are only 45 modes). */
export function plateField([n, m]: Mode): PlateField {
  const key = `${n}:${m}`
  const cached = fieldCache.get(key)
  if (cached) return cached
  const size = FIELD_SIZE
  const f = new Float32Array(size * size)
  const gx = new Float32Array(size * size)
  const gy = new Float32Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = col / (size - 1)
      const y = row / (size - 1)
      const k = row * size + col
      f[k] = displacement(x, y, [n, m])
      const [ddx, ddy] = gradient(x, y, [n, m])
      gx[k] = ddx
      gy[k] = ddy
    }
  }
  const field = { size, f, gx, gy }
  fieldCache.set(key, field)
  return field
}

/** Bilinear sample of a tabulated array at (x, y) ∈ [0, 1]². */
function sample(field: PlateField, values: Float32Array, x: number, y: number): number {
  const last = field.size - 1
  const fx = x * last
  const fy = y * last
  const c = Math.min(last - 1, Math.floor(fx))
  const r = Math.min(last - 1, Math.floor(fy))
  const tx = fx - c
  const ty = fy - r
  const k = r * field.size + c
  const top = values[k]! + (values[k + 1]! - values[k]!) * tx
  const bottom =
    values[k + field.size]! + (values[k + field.size + 1]! - values[k + field.size]!) * tx
  return top + (bottom - top) * ty
}

/** Field value and gradient at (x, y), interpolated from the table. */
export function sampleField(field: PlateField, x: number, y: number): [number, number, number] {
  return [
    sample(field, field.f, x, y),
    sample(field, field.gx, x, y),
    sample(field, field.gy, x, y),
  ]
}

/**
 * One step of sand on the plate: each grain slides down the vibration energy f² towards the
 * nodal lines and jitters in proportion to how much the plate moves under it (so grains on
 * moving parts keep bouncing). `sand` holds x0, y0, x1, y1… in [0, 1]. Uses the cached field
 * table, so a step costs a few array reads per grain instead of eight cos/sin calls.
 */
export function settleGrains(sand: Float32Array, mode: Mode, random: () => number, rate = 1) {
  const field = plateField(mode)
  const maxStep = 0.012 * rate
  for (let i = 0; i < sand.length; i += 2) {
    const x = sand[i]!
    const y = sand[i + 1]!
    const f = sample(field, field.f, x, y)
    const gx = sample(field, field.gx, x, y)
    const gy = sample(field, field.gy, x, y)
    const jitter = 0.01 * rate * Math.abs(f)
    let dx = -0.0025 * rate * f * gx + (random() - 0.5) * jitter
    let dy = -0.0025 * rate * f * gy + (random() - 0.5) * jitter
    dx = Math.max(-maxStep, Math.min(maxStep, dx))
    dy = Math.max(-maxStep, Math.min(maxStep, dy))
    sand[i] = Math.min(1, Math.max(0, x + dx))
    sand[i + 1] = Math.min(1, Math.max(0, y + dy))
  }
}
