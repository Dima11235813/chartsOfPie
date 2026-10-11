import { midiToNote, noteToMidi, type PitchClass } from './notes'
import type { ScaleDefinition } from './scales'

/**
 * How the ten digits (or the k symbols of another alphabet, F05.5) are laid onto a scale. Scales have 5–12 notes, so this is a creative choice
 * with an audible effect on range and melodic shape. See proj-mgmt/research/R-001.
 */
export const MAPPING_STRATEGIES = [
  {
    id: 'ascending',
    name: 'Ascending',
    description: 'Digit n plays the nth scale note, climbing into the next octave (the original)',
  },
  {
    id: 'centred',
    name: 'Centred',
    description: '5 is the root; smaller digits step down, larger digits step up',
  },
  {
    id: 'wrap',
    name: 'One octave',
    description:
      'Digits wrap around one octave, so some digits share a note (e.g. 0 and 5 on a pentatonic)',
  },
  {
    id: 'semitones',
    name: 'Semitones',
    description: 'Digit n is n semitones above the root — the scale is ignored',
  },
] as const

export type MappingStrategy = (typeof MAPPING_STRATEGIES)[number]['id']

/** MIDI note of a scale degree; degrees may be negative or exceed the scale length. */
export function degreeToMidi(scale: ScaleDefinition, rootMidi: number, degree: number): number {
  const n = scale.intervals.length
  const octave = Math.floor(degree / n)
  const index = degree - octave * n
  return rootMidi + octave * 12 + scale.intervals[index]!
}

/**
 * MIDI note of a symbol. `alphabetSize` (10 for decimal digits) sets the range checked and the
 * centre of the `centred` mapping (⌊k/2⌋: 5 for digits, 6 for the 12 pitch classes of mod 12).
 */
export function digitToMidi(
  digit: number,
  strategy: MappingStrategy,
  scale: ScaleDefinition,
  rootMidi: number,
  alphabetSize = 10,
): number {
  if (!Number.isInteger(digit) || digit < 0 || digit >= alphabetSize) {
    throw new RangeError(
      alphabetSize === 10
        ? `Not a decimal digit: ${digit}`
        : `Symbol ${digit} is outside 0..${alphabetSize - 1}`,
    )
  }
  switch (strategy) {
    case 'ascending':
      return degreeToMidi(scale, rootMidi, digit)
    case 'centred':
      return degreeToMidi(scale, rootMidi, digit - Math.floor(alphabetSize / 2))
    case 'wrap':
      return degreeToMidi(scale, rootMidi, digit % scale.intervals.length)
    case 'semitones':
      return rootMidi + digit
  }
}

/**
 * The notes (index = symbol) for a scale, root, octave and strategy: ten for decimal digits, k for
 * a k-symbol alphabet. With `semitones`, symbol s of mod 12 is exactly pitch class s above the root.
 */
export function digitNoteTable(
  scale: ScaleDefinition,
  root: PitchClass,
  octave: number,
  strategy: MappingStrategy,
  alphabetSize = 10,
): string[] {
  const rootMidi = noteToMidi(`${root}${octave}`)
  return Array.from({ length: alphabetSize }, (_, digit) =>
    midiToNote(digitToMidi(digit, strategy, scale, rootMidi, alphabetSize)),
  )
}
