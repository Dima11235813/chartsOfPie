import { midiToNote, noteToMidi, type PitchClass } from './notes'
import type { ScaleDefinition } from './scales'

/**
 * How the ten digits are laid onto a scale. Scales have 5–12 notes, so this is a creative choice
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

export function digitToMidi(
  digit: number,
  strategy: MappingStrategy,
  scale: ScaleDefinition,
  rootMidi: number,
): number {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new RangeError(`Not a decimal digit: ${digit}`)
  }
  switch (strategy) {
    case 'ascending':
      return degreeToMidi(scale, rootMidi, digit)
    case 'centred':
      return degreeToMidi(scale, rootMidi, digit - 5)
    case 'wrap':
      return degreeToMidi(scale, rootMidi, digit % scale.intervals.length)
    case 'semitones':
      return rootMidi + digit
  }
}

/** The ten notes (index = digit) for a scale, root, octave and strategy. */
export function digitNoteTable(
  scale: ScaleDefinition,
  root: PitchClass,
  octave: number,
  strategy: MappingStrategy,
): string[] {
  const rootMidi = noteToMidi(`${root}${octave}`)
  return Array.from({ length: 10 }, (_, digit) =>
    midiToNote(digitToMidi(digit, strategy, scale, rootMidi)),
  )
}
