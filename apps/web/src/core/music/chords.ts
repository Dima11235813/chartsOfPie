import { PITCH_CLASSES } from './notes'

export interface ChordQuality {
  readonly id: string
  /** Suffix appended to the root, e.g. `m7` in `Am7`. */
  readonly symbol: string
  readonly name: string
  /** Pitch classes relative to the root. */
  readonly intervals: readonly number[]
}

/**
 * Chord templates, most common first. Identification tries the bass note as root before any other
 * note, so ambiguous sets (C6 = Am7/C, Csus2 = Gsus4/C, augmented triads) resolve to the reading a
 * musician would give when that note is in the bass.
 */
export const CHORD_QUALITIES: readonly ChordQuality[] = [
  { id: 'major', symbol: '', name: 'major', intervals: [0, 4, 7] },
  { id: 'minor', symbol: 'm', name: 'minor', intervals: [0, 3, 7] },
  { id: 'diminished', symbol: 'dim', name: 'diminished', intervals: [0, 3, 6] },
  { id: 'augmented', symbol: 'aug', name: 'augmented', intervals: [0, 4, 8] },
  { id: 'sus2', symbol: 'sus2', name: 'suspended 2nd', intervals: [0, 2, 7] },
  { id: 'sus4', symbol: 'sus4', name: 'suspended 4th', intervals: [0, 5, 7] },
  { id: 'dominant7', symbol: '7', name: 'dominant 7th', intervals: [0, 4, 7, 10] },
  { id: 'major7', symbol: 'maj7', name: 'major 7th', intervals: [0, 4, 7, 11] },
  { id: 'minor7', symbol: 'm7', name: 'minor 7th', intervals: [0, 3, 7, 10] },
  { id: 'half-diminished', symbol: 'm7♭5', name: 'half-diminished', intervals: [0, 3, 6, 10] },
  { id: 'diminished7', symbol: 'dim7', name: 'diminished 7th', intervals: [0, 3, 6, 9] },
  { id: 'minor-major7', symbol: 'm(maj7)', name: 'minor-major 7th', intervals: [0, 3, 7, 11] },
  { id: 'major6', symbol: '6', name: 'major 6th', intervals: [0, 4, 7, 9] },
  { id: 'minor6', symbol: 'm6', name: 'minor 6th', intervals: [0, 3, 7, 9] },
  { id: 'add9', symbol: 'add9', name: 'added 9th', intervals: [0, 2, 4, 7] },
]

export interface IdentifiedChord {
  /** e.g. `Am7`, `C/E`. */
  readonly symbol: string
  readonly root: string
  readonly bass: string
  readonly quality: ChordQuality
  /** Distinct pitch classes, 0 = C. */
  readonly pitchClasses: readonly number[]
}

const pitchClass = (midi: number) => ((midi % 12) + 12) % 12

const sameSet = (a: readonly number[], b: ReadonlySet<number>) =>
  a.length === b.size && a.every((value) => b.has(value))

/**
 * Name the chord formed by a set of simultaneous MIDI notes (any voicing, any octaves).
 * Returns null for fewer than three distinct pitch classes or unrecognised clusters.
 */
export function identifyChord(midiNotes: readonly number[]): IdentifiedChord | null {
  if (midiNotes.length === 0) return null
  const pcs = [...new Set(midiNotes.map(pitchClass))].sort((a, b) => a - b)
  if (pcs.length < 3) return null
  const bassPc = pitchClass(Math.min(...midiNotes))
  const candidates = [bassPc, ...pcs.filter((pc) => pc !== bassPc)]
  for (const root of candidates) {
    const relative = new Set(pcs.map((pc) => (pc - root + 12) % 12))
    const quality = CHORD_QUALITIES.find((q) => sameSet(q.intervals, relative))
    if (quality) {
      const rootName = PITCH_CLASSES[root]!
      const bassName = PITCH_CLASSES[bassPc]!
      const slash = root === bassPc ? '' : `/${bassName}`
      return {
        symbol: `${rootName}${quality.symbol}${slash}`,
        root: rootName,
        bass: bassName,
        quality,
        pitchClasses: pcs,
      }
    }
  }
  return null
}

const INTERVAL_NAMES = [
  'unison',
  'minor 2nd',
  'major 2nd',
  'minor 3rd',
  'major 3rd',
  'perfect 4th',
  'tritone',
  'perfect 5th',
  'minor 6th',
  'major 6th',
  'minor 7th',
  'major 7th',
]

/** Name of the interval between two notes, reduced to within an octave. */
export function intervalName(a: number, b: number): string {
  const semitones = Math.abs(a - b)
  if (semitones > 0 && semitones % 12 === 0) return 'octave'
  return INTERVAL_NAMES[semitones % 12]!
}
