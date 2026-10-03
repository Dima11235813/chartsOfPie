/** Chromatic pitch classes, spelled with sharps (matches Tone.js note names). */
export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const
export type PitchClass = (typeof PITCH_CLASSES)[number]

const FLAT_TO_SHARP: Record<string, PitchClass> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
}

/** Scientific pitch notation → MIDI number. `C4` (middle C) is 60. */
export function noteToMidi(note: string): number {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note)
  if (!match) throw new Error(`Invalid note name: ${note}`)
  const name = FLAT_TO_SHARP[match[1]!] ?? (match[1] as PitchClass)
  const pitchClass = PITCH_CLASSES.indexOf(name)
  if (pitchClass < 0) throw new Error(`Invalid note name: ${note}`)
  return (Number(match[2]) + 1) * 12 + pitchClass
}

/** MIDI number → scientific pitch notation using sharps. */
export function midiToNote(midi: number): string {
  if (!Number.isInteger(midi)) throw new Error(`MIDI note must be an integer: ${midi}`)
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${PITCH_CLASSES[pitchClass]}${octave}`
}
