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

/**
 * One step of sand on the plate: each grain slides down the vibration energy f² towards the
 * nodal lines and jitters in proportion to how much the plate moves under it (so grains on
 * moving parts keep bouncing). `sand` holds x0, y0, x1, y1… in [0, 1].
 */
export function settleGrains(sand: Float32Array, mode: Mode, random: () => number, rate = 1) {
  const maxStep = 0.012 * rate
  for (let i = 0; i < sand.length; i += 2) {
    const x = sand[i]!
    const y = sand[i + 1]!
    const f = displacement(x, y, mode)
    const [gx, gy] = gradient(x, y, mode)
    let dx = -0.0025 * rate * f * gx + (random() - 0.5) * 0.01 * rate * Math.abs(f)
    let dy = -0.0025 * rate * f * gy + (random() - 0.5) * 0.01 * rate * Math.abs(f)
    dx = Math.max(-maxStep, Math.min(maxStep, dx))
    dy = Math.max(-maxStep, Math.min(maxStep, dy))
    sand[i] = Math.min(1, Math.max(0, x + dx))
    sand[i + 1] = Math.min(1, Math.max(0, y + dy))
  }
}
