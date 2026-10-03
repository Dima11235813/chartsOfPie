import { digitNoteTable } from '../music/mapping'
import { getScale } from '../music/scaleCatalogue'
import { LEGACY_DIGIT_DURATIONS, legacyStepDelayMs } from '../music/legacyMapping'
import { noteToMidi, midiToNote } from '../music/notes'
import type { ArrangedStep } from '../engine/playbackEngine'
import type { CompositionConfig } from './config'

/** Tone.js notation → length in beats (quarter notes). The original ran at Tone's default 120 BPM. */
const NOTATION_BEATS: Record<string, number> = {
  '1n': 4,
  '2n': 2,
  '4n': 1,
  '8n': 0.5,
  '16n': 0.25,
  '1t': 8 / 3,
  '2t': 4 / 3,
  '4t': 2 / 3,
  '8t': 1 / 3,
  '16t': 1 / 6,
}

export const notationToSeconds = (notation: string, bpm: number) => {
  const beats = NOTATION_BEATS[notation]
  if (beats === undefined) throw new Error(`Unsupported notation: ${notation}`)
  return (beats * 60) / bpm
}

const LEGACY_BPM = 120

/** The ten notes (index = digit) a config produces. */
export function noteTableFor(config: CompositionConfig): string[] {
  return digitNoteTable(getScale(config.scale), config.root, config.octave, config.mapping)
}

/**
 * Drone notes, kept below the melody: an octave under the root (two for the centred mapping,
 * whose melody reaches ~9 semitones below the root), never lower than octave 2. Adds the perfect
 * fifth only when the scale contains one (not Locrian or whole tone) and the mapping uses the
 * scale; otherwise doubles the root an octave up.
 */
export function droneNotesFor(config: CompositionConfig): string[] {
  const octavesBelow = config.mapping === 'centred' ? 2 : 1
  const octave = Math.max(2, config.octave - octavesBelow)
  const root = noteToMidi(`${config.root}${octave}`)
  const hasFifth = getScale(config.scale).intervals.includes(7) && config.mapping !== 'semitones'
  return [midiToNote(root), midiToNote(root + (hasFifth ? 7 : 12))]
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * Turns digits into notes with timing and dynamics according to a config. Stateful only to track
 * the position within the beat (for accents); call `reset()` when playback restarts.
 */
export class Arranger {
  private stepInBeat = 0
  private notes: string[]

  constructor(
    private config: CompositionConfig,
    private readonly random: () => number = Math.random,
  ) {
    this.notes = noteTableFor(config)
  }

  get noteTable(): readonly string[] {
    return this.notes
  }

  setConfig(config: CompositionConfig): void {
    this.config = config
    this.notes = noteTableFor(config)
  }

  reset(): void {
    this.stepInBeat = 0
  }

  arrange(digit: number): ArrangedStep {
    const { config } = this
    const stepSec = 60 / config.bpm / config.subdivision
    const isRest =
      (config.rhythm === 'steady-rests' || config.rhythm === 'digit-length') && digit === 0
    const steps = config.rhythm === 'digit-length' ? Math.max(1, digit) : 1

    let durationSec: number
    let durationLabel: string
    if (config.rhythm === 'legacy') {
      durationLabel = LEGACY_DIGIT_DURATIONS[digit]!
      const bpm = config.timing === 'tempo' ? config.bpm : LEGACY_BPM
      durationSec = notationToSeconds(durationLabel, bpm)
    } else {
      durationSec = steps * stepSec * config.legato
      durationLabel = `${durationSec.toFixed(2)} s`
    }

    let delayMs: number
    if (config.timing !== 'tempo') delayMs = legacyStepDelayMs(this.random)
    // Original note lengths on a tempo: play them back to back so they neither overlap nor cut off.
    else if (config.rhythm === 'legacy') delayMs = durationSec * 1000
    else delayMs = steps * stepSec * 1000

    // Leave headroom for humanize to vary both ways; Original (no humanize) stays at full velocity.
    let velocity = config.humanize > 0 ? 0.9 : 1
    if (config.dynamics === 'accented') {
      const onBeat = this.stepInBeat === 0
      velocity = onBeat ? 0.85 : 0.68
    }
    if (config.humanize > 0) {
      velocity += (this.random() - 0.5) * 0.3 * config.humanize
    }
    this.stepInBeat = (this.stepInBeat + steps) % config.subdivision

    return {
      note: isRest ? null : this.notes[digit]!,
      durationLabel: isRest ? 'rest' : durationLabel,
      durationSec,
      velocity: clamp01(velocity),
      delayMs,
    }
  }
}
