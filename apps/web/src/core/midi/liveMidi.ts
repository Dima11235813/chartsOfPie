/**
 * Live MIDI to an external instrument (e.g. a Nord Electro 4 over USB). Pure scheduling logic:
 * the browser's MIDIOutput is injected as `send(bytes, timestampMs)`, so this is unit-tested
 * without hardware. Spec: MIDI 1.0 channel voice messages.
 */

export type SendMidi = (bytes: number[], timestampMs?: number) => void

export interface LiveMidiSettings {
  /** 1–16 as shown on instruments (the Nord's MIDI channel, System menu; default 1). */
  channel: number
  /** Added to every timestamp: USB + instrument latency, to line up with the screen (ms). */
  latencyMs: number
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Velocity 0–1 → MIDI 1–127 (0 would mean note-off). */
export const midiVelocity = (velocity: number) => clamp(Math.round(velocity * 127), 1, 127)

export const noteOn = (channel: number, midi: number, velocity: number) => [
  0x90 | (channel - 1),
  clamp(midi, 0, 127),
  midiVelocity(velocity),
]
export const noteOff = (channel: number, midi: number) => [
  0x80 | (channel - 1),
  clamp(midi, 0, 127),
  0,
]
/** Program change; `program` is 1–128 as instruments display it. */
export const programChange = (channel: number, program: number) => [
  0xc0 | (channel - 1),
  clamp(program, 1, 128) - 1,
]
/** CC 123 All Notes Off plus CC 64 sustain off, for pause and panic. */
export const allNotesOff = (channel: number) => [
  [0xb0 | (channel - 1), 64, 0],
  [0xb0 | (channel - 1), 123, 0],
]

/**
 * Sends notes with their exact start/end times (performance.now() milliseconds), remembers what is
 * sounding so pause can silence it, and holds drone notes until stop.
 */
export class LiveMidiSender {
  private readonly sounding = new Map<number, number>()

  constructor(
    private readonly send: SendMidi,
    private settings: LiveMidiSettings,
  ) {}

  configure(settings: LiveMidiSettings) {
    this.stop()
    this.settings = settings
  }

  /** Play `midi` from `atMs` for `durationMs` (both on the performance.now() clock). */
  note(midi: number, atMs: number, durationMs: number, velocity: number) {
    const { channel, latencyMs } = this.settings
    const start = atMs + latencyMs
    // Re-striking a key that is still down: release it first so the new note speaks.
    if (this.sounding.has(midi)) this.send(noteOff(channel, midi), start - 1)
    this.send(noteOn(channel, midi, velocity), start)
    const end = start + Math.max(10, durationMs)
    this.send(noteOff(channel, midi), end)
    this.sounding.set(midi, end)
    // Forget notes that have ended (keeps the map small during long performances).
    for (const [key, until] of this.sounding) if (until < start) this.sounding.delete(key)
  }

  /** Hold notes (the drone) until `stop`. */
  hold(midis: readonly number[], atMs: number, velocity = 0.45) {
    const { channel, latencyMs } = this.settings
    for (const midi of midis) {
      this.send(noteOn(channel, midi, velocity), atMs + latencyMs)
      this.sounding.set(midi, Infinity)
    }
  }

  program(program: number) {
    this.send(programChange(this.settings.channel, program))
  }

  /** Pause/panic: release everything now (explicit note-offs, then All Notes Off). */
  stop() {
    const { channel } = this.settings
    for (const midi of this.sounding.keys()) this.send(noteOff(channel, midi))
    this.sounding.clear()
    for (const message of allNotesOff(channel)) this.send(message)
  }
}

/** Convert an audio-clock time (seconds) to performance.now() ms using an output timestamp pair. */
export function audioTimeToPerformanceMs(
  audioTimeSec: number,
  stamp: { contextTime: number; performanceTime: number },
): number {
  return stamp.performanceTime + (audioTimeSec - stamp.contextTime) * 1000
}
