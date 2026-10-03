import { MAJOR_PENTATONIC, type ScaleDefinition } from './scales'

export type ScaleFamily = 'diatonic mode' | 'pentatonic' | 'minor variant' | 'symmetric' | 'blues'

export interface CatalogueScale extends ScaleDefinition {
  readonly family: ScaleFamily
  /** One-line description of the sound, for the UI. */
  readonly character: string
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const

/**
 * Rotate a scale to start on another of its degrees: the modes of a scale are its rotations.
 * `rotateIntervals([0,2,4,5,7,9,11], 1)` → Dorian `[0,2,3,5,7,9,10]`.
 */
export function rotateIntervals(intervals: readonly number[], steps: number): number[] {
  const n = intervals.length
  const start = ((steps % n) + n) % n
  const offset = intervals[start]!
  return Array.from({ length: n }, (_, i) => {
    const value = intervals[(start + i) % n]! - offset
    return value < 0 ? value + 12 : value
  })
}

const MODE_NAMES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian']
const MODE_CHARACTER = [
  'Bright and resolved — the everyday major scale',
  'Minor but hopeful, thanks to its raised 6th',
  'Dark and Spanish-flavoured — the flat 2nd',
  'Dreamy and floating — the raised 4th',
  'Bluesy major with a flat 7th',
  'Melancholy — the natural minor scale',
  'Unstable and tense — the diminished 5th',
]

const modes: CatalogueScale[] = MODE_NAMES.map((name, i) => ({
  id: name.toLowerCase(),
  name: i === 0 ? 'Major (Ionian)' : i === 5 ? 'Natural minor (Aeolian)' : name,
  intervals: rotateIntervals(MAJOR, i),
  family: 'diatonic mode',
  character: MODE_CHARACTER[i]!,
}))

/** Every scale the app offers, in display order. Ids are stable: they are saved in configs. */
export const SCALE_CATALOGUE: readonly CatalogueScale[] = [
  {
    ...MAJOR_PENTATONIC,
    family: 'pentatonic',
    character: 'Open and consonant — no half steps, so nothing clashes (the original sound)',
  },
  {
    id: 'minor-pentatonic',
    name: 'Minor pentatonic',
    intervals: rotateIntervals(MAJOR_PENTATONIC.intervals, 4),
    family: 'pentatonic',
    character: 'Earthy and soulful — the backbone of rock and blues solos',
  },
  ...modes,
  {
    id: 'harmonic-minor',
    name: 'Harmonic minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    family: 'minor variant',
    character: 'Exotic and dramatic — an augmented 2nd between the ♭6 and the raised 7th',
  },
  {
    id: 'melodic-minor',
    name: 'Melodic minor (ascending)',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    family: 'minor variant',
    character: 'Smooth “jazz minor” — minor 3rd with a major top half',
  },
  {
    id: 'blues',
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    family: 'blues',
    character: 'Minor pentatonic plus the gritty “blue note” flat 5th',
  },
  {
    id: 'whole-tone',
    name: 'Whole tone',
    intervals: [0, 2, 4, 6, 8, 10],
    family: 'symmetric',
    character: 'Weightless and ambiguous — every step is the same size',
  },
  {
    id: 'chromatic',
    name: 'Chromatic',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    family: 'symmetric',
    character: 'All twelve notes — the raw digits, no key at all',
  },
]

export function getScale(id: string): CatalogueScale {
  const scale = SCALE_CATALOGUE.find((s) => s.id === id)
  if (!scale) throw new Error(`Unknown scale: ${id}`)
  return scale
}
