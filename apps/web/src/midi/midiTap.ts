import { LOOK_AHEAD_SEC, type NotePlayer } from '../audio/notePlayer'
import type { SoundSettings } from '../audio/soundChain'
import { LiveMidiSender } from '../core/midi/liveMidi'
import { noteToMidi } from '../core/music/notes'

/** Where notes go besides (or instead of) the built-in sound. */
export interface MidiRoute {
  sender: LiveMidiSender
  /** false = "MIDI only": the built-in instrument is silenced (the views still follow). */
  internalSound: boolean
}

/**
 * Tone schedules each note this far ahead of "now" (its lookAhead); MIDI notes get the same lead
 * so the external instrument and the built-in sound start together.
 */
export const AUDIO_LEAD_MS = LOOK_AHEAD_SEC * 1000
const MAX_DRIFT_MS = 80

export interface MidiTappedPlayer extends NotePlayer {
  setRoute(route: MidiRoute | null): void
}

/**
 * Wrap a NotePlayer so every note is also sent to a MIDI instrument, on the same timing grid the
 * audio player uses (each step lands `gapMs` after the previous one, re-anchored if it drifts).
 */
export function withMidiTap(player: NotePlayer, now = () => performance.now()): MidiTappedPlayer {
  let route: MidiRoute | null = null
  let userMuted = false
  let settings: SoundSettings | null = null
  let lastMs: number | null = null
  let droneHeld = false

  const applyMute = () => player.setMuted(userMuted || (route !== null && !route.internalSound))
  const release = () => {
    route?.sender.stop()
    lastMs = null
    droneHeld = false
  }

  return {
    ...player,
    async start(initial) {
      settings = initial
      await player.start(initial)
    },
    async update(next) {
      // A different drone must be re-held on the instrument.
      if (droneHeld && next.drone?.join() !== settings?.drone?.join()) {
        route?.sender.stop()
        droneHeld = false
      }
      settings = next
      await player.update(next)
    },
    playStep(note, durationSec, velocity, gapMs) {
      player.playStep(note, durationSec, velocity, gapMs)
      if (!route) return
      const ideal = now() + AUDIO_LEAD_MS
      let at = lastMs === null ? ideal : lastMs + gapMs
      if (Math.abs(at - ideal) > MAX_DRIFT_MS) at = ideal
      lastMs = at
      if (!droneHeld && settings?.drone?.length) {
        route.sender.hold(settings.drone.map(noteToMidi), at)
        droneHeld = true
      }
      if (note !== null) route.sender.note(noteToMidi(note), at, durationSec * 1000, velocity)
    },
    stop() {
      player.stop()
      release()
    },
    setMuted(value) {
      userMuted = value
      applyMute()
    },
    dispose() {
      release()
      player.dispose()
    },
    setRoute(next) {
      release()
      route = next
      applyMute()
    },
  }
}
