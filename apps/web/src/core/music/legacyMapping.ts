import { buildScaleNotes, MAJOR_PENTATONIC } from './scales'

/**
 * The original (2019) Charts of Pie musical encoding, preserved exactly so the modernised app
 * sounds the same. Future encodings (E02) are added alongside, never by editing these tables.
 */

/** Digit → note: C major pentatonic ascending from C4 over two octaves. */
export const LEGACY_DIGIT_NOTES: readonly string[] = buildScaleNotes('C', 4, MAJOR_PENTATONIC, 10)

/** Digit → Tone.js duration notation (n = note, t = triplet). */
export const LEGACY_DIGIT_DURATIONS: readonly string[] = [
  '16n',
  '1n',
  '1t',
  '2n',
  '2t',
  '4n',
  '4t',
  '8n',
  '8t',
  '16t',
]

/** Base unit of the legacy random wait between digits. */
export const LEGACY_DELAY_UNIT_MS = 42

/**
 * The legacy wait before the next digit: a random whole number 0–10 times 42 ms (0–420 ms).
 * Reproduces `Math.random().toFixed(1) * 10 * 42` from the original code.
 */
export function legacyStepDelayMs(random: () => number = Math.random): number {
  return Math.round(Number(random().toFixed(1)) * 10) * LEGACY_DELAY_UNIT_MS
}

export function legacyNoteForDigit(digit: number): string {
  const note = LEGACY_DIGIT_NOTES[digit]
  if (note === undefined) throw new RangeError(`Not a decimal digit: ${digit}`)
  return note
}

export function legacyDurationForDigit(digit: number): string {
  const duration = LEGACY_DIGIT_DURATIONS[digit]
  if (duration === undefined) throw new RangeError(`Not a decimal digit: ${digit}`)
  return duration
}
