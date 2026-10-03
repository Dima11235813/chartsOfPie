/**
 * Harmonograph / Lissajous maths for the sounding interval. Two notes become two perpendicular
 * oscillations; their frequency ratio decides the figure. Small whole-number ratios (3:2, 5:4)
 * draw closed, stable curves — consonance you can see — while equal-tempered intervals are very
 * slightly off those ratios, so their figures slowly turn (the "beating" of 12-TET).
 */

/** Equal-tempered frequency of a MIDI note (A4 = 440 Hz). */
export const frequencyOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** Just-intonation ratios for 0–11 semitones (5-limit, common textbook choices). */
export const JUST_RATIOS: readonly (readonly [number, number])[] = [
  [1, 1],
  [16, 15],
  [9, 8],
  [6, 5],
  [5, 4],
  [4, 3],
  [45, 32],
  [3, 2],
  [8, 5],
  [5, 3],
  [9, 5],
  [15, 8],
]

export interface IntervalRatio {
  /** Equal-tempered ratio high/low (≥ 1). */
  tempered: number
  /** Nearest just ratio, octaves included, as [numerator, denominator]. */
  just: [number, number]
  /** Difference between tempered and just, in cents (1/100 semitone). */
  cents: number
}

export function intervalRatio(lowMidi: number, highMidi: number): IntervalRatio {
  const semitones = Math.abs(highMidi - lowMidi)
  const octaves = Math.floor(semitones / 12)
  const [num, den] = JUST_RATIOS[semitones % 12]!
  const just: [number, number] = [num * 2 ** octaves, den]
  const tempered = Math.pow(2, semitones / 12)
  const cents = 1200 * Math.log2(tempered / (just[0] / just[1]))
  return { tempered, just, cents }
}

/**
 * Points of a decaying Lissajous figure x = sin(t + phase), y = sin(r·t), t ∈ [0, turns·2π].
 * Returns interleaved [x0, y0, x1, y1, …] in [-1, 1] with amplitude decaying to `decay`.
 */
export function harmonographPoints(
  ratio: number,
  phase: number,
  { samples = 2400, turns = 24, decay = 0.55 } = {},
): Float32Array {
  const points = new Float32Array(samples * 2)
  const tMax = turns * Math.PI * 2
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * tMax
    const amplitude = Math.pow(decay, i / (samples - 1))
    points[i * 2] = amplitude * Math.sin(t + phase)
    points[i * 2 + 1] = amplitude * Math.sin(ratio * t)
  }
  return points
}
