import { droneNotesFor } from '../composition/arranger'
import type { CompositionConfig, InstrumentId } from '../composition/config'
import type { PerformedNote } from '../composition/performanceLog'
import { noteToMidi } from '../music/notes'
import { writeMidi, type MidiTrack } from './midiFile'

/** Closest General MIDI program (0-based) for each instrument, so DAWs pick a sensible sound. */
export const GENERAL_MIDI_PROGRAM: Record<InstrumentId, number> = {
  classic: 80, // Lead 1 (square)
  piano: 0, // Acoustic Grand Piano
  'electric-piano': 4, // Electric Piano 1
  'music-box': 10, // Music Box
  marimba: 12, // Marimba
  harp: 46, // Orchestral Harp
  'warm-pad': 89, // Pad 2 (warm)
  'pure-sine': 79, // Ocarina — the closest to a pure tone
}

/**
 * Turn a performance into a MIDI file. Tempo-timed configs keep their BPM so the notes line up with
 * the DAW's grid; the original random timing is written at 120 BPM (time is exact either way).
 */
export function performanceToMidi(
  notes: readonly PerformedNote[],
  config: CompositionConfig,
): Uint8Array {
  const bpm = config.timing === 'tempo' ? config.bpm : 120
  const offset = notes[0]?.startSec ?? 0
  const melody: MidiTrack = {
    name: 'Pi melody', // MIDI text events are ASCII
    channel: 0,
    program: GENERAL_MIDI_PROGRAM[config.instrument],
    notes: notes.map((n) => ({
      midi: n.midi,
      startSec: n.startSec - offset,
      durationSec: n.durationSec,
      velocity: n.velocity,
    })),
  }
  const tracks: MidiTrack[] = [melody]
  const last = notes.at(-1)
  if (config.drone && last) {
    const end = last.startSec + last.durationSec - offset
    tracks.push({
      name: 'Drone',
      channel: 1,
      program: 89,
      notes: droneNotesFor(config).map((note) => ({
        midi: noteToMidi(note),
        startSec: 0,
        durationSec: end,
        velocity: 0.5,
      })),
    })
  }
  return writeMidi({ bpm, tracks })
}
