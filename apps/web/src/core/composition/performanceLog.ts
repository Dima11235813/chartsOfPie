import { identifyChord, type IdentifiedChord } from '../music/chords'
import { noteToMidi } from '../music/notes'

/** One note as it was performed, in musical time (seconds since playback started, pauses excluded). */
export interface PerformedNote {
  readonly index: number
  readonly digit: number
  readonly note: string
  readonly midi: number
  readonly startSec: number
  readonly durationSec: number
  readonly velocity: number
}

export interface PerformedStep {
  readonly index: number
  readonly digit: number
  readonly note: string | null
  readonly durationSec: number
  readonly velocity: number
  readonly delayMs: number
}

/** A chord that arose because notes happened to overlap when a new note started. */
export interface CoincidentChord {
  readonly atSec: number
  /** Index of the digit whose onset completed the chord. */
  readonly index: number
  readonly chord: IdentifiedChord
  readonly notes: readonly PerformedNote[]
}

export const DEFAULT_MAX_NOTES = 50_000

/**
 * Records what was played (for sheet music, chord spotting and MIDI export). Time advances by each
 * step's scheduled gap, so it matches the audio grid exactly and ignores pauses. Keeps at most
 * `maxNotes` (oldest dropped).
 */
export class PerformanceLog {
  private readonly played: PerformedNote[] = []
  private readonly chordList: CoincidentChord[] = []
  private clock = 0
  private listeners = new Set<() => void>()

  /** Old notes are dropped in batches of 1/16 of the cap (exact for tiny caps). */
  private readonly trimBatch: number

  constructor(private readonly maxNotes = DEFAULT_MAX_NOTES) {
    this.trimBatch = Math.floor(maxNotes / 16)
  }

  /** Musical time at which the next step will start. */
  get elapsedSec(): number {
    return this.clock
  }

  /** Everything kept (up to `maxNotes`, plus at most 1/16 more before old notes are trimmed). */
  get notes(): readonly PerformedNote[] {
    return this.played
  }

  get chords(): readonly CoincidentChord[] {
    return this.chordList
  }

  /** Time of the most recent onset (rests included), or 0. */
  lastOnsetSec = 0

  /** Steps (digits, rests included) recorded since the last reset. */
  stepCount = 0

  /** The most recent step, or null after a reset. */
  lastStep: PerformedStep | null = null

  record(step: PerformedStep): CoincidentChord | null {
    const startSec = this.clock
    this.lastOnsetSec = startSec
    this.stepCount += 1
    this.lastStep = step
    this.clock += step.delayMs / 1000
    let chord: CoincidentChord | null = null
    if (step.note !== null) {
      const performed: PerformedNote = {
        index: step.index,
        digit: step.digit,
        note: step.note,
        midi: noteToMidi(step.note),
        startSec,
        durationSec: step.durationSec,
        velocity: step.velocity,
      }
      this.played.push(performed)
      // Trim in batches: shifting a 50,000-note array on every note costs more than the note.
      if (this.played.length > this.maxNotes + this.trimBatch)
        this.played.splice(0, this.played.length - this.maxNotes)
      chord = this.detectChord(performed)
      if (chord) {
        this.chordList.push(chord)
        if (this.chordList.length > this.maxNotes + this.trimBatch)
          this.chordList.splice(0, this.chordList.length - this.maxNotes)
      }
    }
    this.listeners.forEach((listener) => listener())
    return chord
  }

  /** Notes sounding at `timeSec` (start ≤ t < end). */
  soundingAt(timeSec: number): PerformedNote[] {
    const result: PerformedNote[] = []
    for (let i = this.played.length - 1; i >= 0; i--) {
      const note = this.played[i]!
      if (note.startSec < timeSec - MAX_NOTE_SEC) break // older notes cannot still be sounding
      if (note.startSec <= timeSec && timeSec < note.startSec + note.durationSec) result.push(note)
    }
    return result.reverse()
  }

  /** Notes sounding at some point in [fromSec, toSec]. Binary search: views ask every frame. */
  notesBetween(fromSec: number, toSec: number): PerformedNote[] {
    const notes = this.played
    // Notes are in start order and none lasts longer than MAX_NOTE_SEC.
    const from = lowerBound(notes.length, (i) => notes[i]!.startSec >= fromSec - MAX_NOTE_SEC)
    const result: PerformedNote[] = []
    for (let i = from; i < notes.length; i++) {
      const n = notes[i]!
      if (n.startSec > toSec) break
      if (n.startSec + n.durationSec >= fromSec) result.push(n)
    }
    return result
  }

  chordsBetween(fromSec: number, toSec: number): CoincidentChord[] {
    const chords = this.chordList
    const from = lowerBound(chords.length, (i) => chords[i]!.atSec >= fromSec)
    const to = lowerBound(chords.length, (i) => chords[i]!.atSec > toSec)
    return chords.slice(from, to)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  reset(): void {
    this.played.length = 0
    this.chordList.length = 0
    this.clock = 0
    this.lastOnsetSec = 0
    this.stepCount = 0
    this.lastStep = null
    this.listeners.forEach((listener) => listener())
  }

  private detectChord(newNote: PerformedNote): CoincidentChord | null {
    const sounding = this.soundingAt(newNote.startSec)
    const identified = identifyChord(sounding.map((n) => n.midi))
    if (!identified) return null
    return { atSec: newNote.startSec, index: newNote.index, chord: identified, notes: sounding }
  }
}

/** Upper bound on any note's length, used to stop scanning history early. */
const MAX_NOTE_SEC = 30

/** First index in [0, n) where `isAfter` turns true (it must be monotonic). */
function lowerBound(n: number, isAfter: (i: number) => boolean): number {
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (isAfter(mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}
