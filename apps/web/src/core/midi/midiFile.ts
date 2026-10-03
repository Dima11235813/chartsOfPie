/**
 * Minimal Standard MIDI File (format 1) writer — enough for exporting performances, no dependency.
 * Spec: "Standard MIDI-File Format Spec. 1.1" (MIDI Manufacturers Association).
 */

export interface MidiNote {
  readonly midi: number
  readonly startSec: number
  readonly durationSec: number
  /** 0–1. */
  readonly velocity: number
}

export interface MidiTrack {
  readonly name: string
  /** 0–15 (9 is percussion in General MIDI). */
  readonly channel: number
  /** General MIDI program 0–127. */
  readonly program: number
  readonly notes: readonly MidiNote[]
}

export interface MidiSong {
  readonly bpm: number
  /** Ticks per quarter note. */
  readonly ppq?: number
  readonly tracks: readonly MidiTrack[]
}

/** Variable-length quantity, as used for delta times. */
export function encodeVlq(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) {
    throw new RangeError(`VLQ out of range: ${value}`)
  }
  const bytes = [value & 0x7f]
  let rest = value >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]
const u16 = (value: number) => [(value >>> 8) & 0xff, value & 0xff]
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0) & 0x7f)

const chunk = (type: string, data: number[]) => [...ascii(type), ...u32(data.length), ...data]

interface TimedEvent {
  tick: number
  /** Note-offs sort before note-ons at the same tick. */
  order: number
  bytes: number[]
}

function trackChunk(events: TimedEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order)
  const data: number[] = []
  let last = 0
  for (const event of events) {
    data.push(...encodeVlq(event.tick - last), ...event.bytes)
    last = event.tick
  }
  data.push(...encodeVlq(0), 0xff, 0x2f, 0x00) // end of track
  return chunk('MTrk', data)
}

const metaText = (type: number, text: string) => {
  const bytes = ascii(text)
  return [0xff, type, ...encodeVlq(bytes.length), ...bytes]
}

export function writeMidi(song: MidiSong): Uint8Array {
  const ppq = song.ppq ?? 480
  const ticksPerSecond = (ppq * song.bpm) / 60
  const toTick = (seconds: number) => Math.max(0, Math.round(seconds * ticksPerSecond))
  const microsPerQuarter = Math.round(60_000_000 / song.bpm)

  const conductor: TimedEvent[] = [
    { tick: 0, order: 0, bytes: metaText(0x03, 'Charts of Pie') },
    {
      tick: 0,
      order: 0,
      bytes: [
        0xff,
        0x51,
        0x03,
        (microsPerQuarter >> 16) & 0xff,
        (microsPerQuarter >> 8) & 0xff,
        microsPerQuarter & 0xff,
      ],
    },
  ]

  const tracks = song.tracks.map((track) => {
    const channel = track.channel & 0x0f
    const events: TimedEvent[] = [
      { tick: 0, order: 0, bytes: metaText(0x03, track.name) },
      { tick: 0, order: 0, bytes: [0xc0 | channel, track.program & 0x7f] },
    ]
    for (const note of track.notes) {
      if (note.midi < 0 || note.midi > 127) continue
      const start = toTick(note.startSec)
      const end = Math.max(start + 1, toTick(note.startSec + note.durationSec))
      const velocity = Math.min(127, Math.max(1, Math.round(note.velocity * 127)))
      events.push({ tick: start, order: 2, bytes: [0x90 | channel, note.midi, velocity] })
      events.push({ tick: end, order: 1, bytes: [0x80 | channel, note.midi, 0] })
    }
    return trackChunk(events)
  })

  const header = chunk('MThd', [...u16(1), ...u16(tracks.length + 1), ...u16(ppq)])
  return Uint8Array.from([...header, ...trackChunk(conductor), ...tracks.flat()])
}
