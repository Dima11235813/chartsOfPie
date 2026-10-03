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

  constructor(private readonly maxNotes = DEFAULT_MAX_NOTES) {}

  /** Musical time at which the next step will start. */
  get elapsedSec(): number {
    return this.clock
  }

  get notes(): readonly PerformedNote[] {
    return this.played
  }

  get chords(): readonly CoincidentChord[] {
    return this.chordList
  }

  /** Time of the most recent onset (rests included), or 0. */
  lastOnsetSec = 0

  record(step: PerformedStep): CoincidentChord | null {
    const startSec = this.clock
    this.lastOnsetSec = startSec
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
      if (this.played.length > this.maxNotes)
        this.played.splice(0, this.played.length - this.maxNotes)
      chord = this.detectChord(performed)
      if (chord) {
        this.chordList.push(chord)
        if (this.chordList.length > this.maxNotes) this.chordList.shift()
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

  /** Notes that start within [fromSec, toSec]. */
  notesBetween(fromSec: number, toSec: number): PerformedNote[] {
    return this.played.filter((n) => n.startSec + n.durationSec >= fromSec && n.startSec <= toSec)
  }

  chordsBetween(fromSec: number, toSec: number): CoincidentChord[] {
    return this.chordList.filter((c) => c.atSec >= fromSec && c.atSec <= toSec)
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
