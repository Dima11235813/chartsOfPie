import { midiToNote, noteToMidi, type PitchClass } from './notes'

/**
 * A scale is a set of semitone offsets from its root within one octave.
 * Every scale, mode and pentatonic is expressible this way, which is what lets the roadmap's
 * scale/mode catalogue (E02) be pure data.
 */
export interface ScaleDefinition {
  readonly id: string
  readonly name: string
  /** Ascending semitone offsets from the root, starting at 0, all < 12. */
  readonly intervals: readonly number[]
}

export const MAJOR_PENTATONIC: ScaleDefinition = {
  id: 'major-pentatonic',
  name: 'Major pentatonic',
  intervals: [0, 2, 4, 7, 9],
}

/**
 * Walk a scale upwards from `root` + `octave`, producing `count` note names.
 * `buildScaleNotes('C', 4, MAJOR_PENTATONIC, 10)` → C4 D4 E4 G4 A4 C5 D5 E5 G5 A5.
 */
export function buildScaleNotes(
  root: PitchClass,
  octave: number,
  scale: ScaleDefinition,
  count: number,
): string[] {
  const { intervals } = scale
  if (intervals.length === 0 || intervals[0] !== 0) {
    throw new Error(`Scale ${scale.id} must start at interval 0`)
  }
  const rootMidi = noteToMidi(`${root}${octave}`)
  return Array.from({ length: count }, (_, degree) => {
    const octaveShift = Math.floor(degree / intervals.length)
    const interval = intervals[degree % intervals.length]!
    return midiToNote(rootMidi + octaveShift * 12 + interval)
  })
}
