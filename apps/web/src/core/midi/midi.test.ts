import { describe, expect, it } from 'vitest'
import { getPreset } from '../composition/presets'
import { PerformanceLog } from '../composition/performanceLog'
import { encodeVlq, writeMidi } from './midiFile'
import { GENERAL_MIDI_PROGRAM, performanceToMidi } from './exportPerformance'
import { INSTRUMENT_IDS } from '../composition/config'

interface ParsedEvent {
  track: number
  tick: number
  status: number
  data: number[]
}

/** Tiny SMF reader for tests: returns header fields and channel/meta events with absolute ticks. */
function parseMidi(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (at: number, length: number) => String.fromCharCode(...bytes.slice(at, at + length))
  expect(text(0, 4)).toBe('MThd')
  const format = view.getUint16(8)
  const trackCount = view.getUint16(10)
  const ppq = view.getUint16(12)
  let offset = 14
  const events: ParsedEvent[] = []
  for (let track = 0; track < trackCount; track++) {
    expect(text(offset, 4)).toBe('MTrk')
    const end = offset + 8 + view.getUint32(offset + 4)
    offset += 8
    let tick = 0
    let ended = false
    while (offset < end) {
      let delta = 0
      let byte: number
      do {
        byte = bytes[offset++]!
        delta = (delta << 7) | (byte & 0x7f)
      } while (byte & 0x80)
      tick += delta
      const status = bytes[offset++]!
      if (status === 0xff) {
        const type = bytes[offset++]!
        const length = bytes[offset++]!
        events.push({
          track,
          tick,
          status: 0xff,
          data: [type, ...bytes.slice(offset, offset + length)],
        })
        offset += length
        if (type === 0x2f) ended = true
      } else {
        const size = (status & 0xf0) === 0xc0 ? 1 : 2
        events.push({ track, tick, status, data: [...bytes.slice(offset, offset + size)] })
        offset += size
      }
    }
    expect(ended).toBe(true)
  }
  return { format, trackCount, ppq, events }
}

describe('encodeVlq', () => {
  it('matches the examples from the SMF spec', () => {
    expect(encodeVlq(0)).toEqual([0x00])
    expect(encodeVlq(0x40)).toEqual([0x40])
    expect(encodeVlq(0x7f)).toEqual([0x7f])
    expect(encodeVlq(0x80)).toEqual([0x81, 0x00])
    expect(encodeVlq(0x2000)).toEqual([0xc0, 0x00])
    expect(encodeVlq(0x3fff)).toEqual([0xff, 0x7f])
    expect(encodeVlq(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f])
    expect(() => encodeVlq(-1)).toThrow(RangeError)
  })
})

describe('writeMidi', () => {
  it('writes a format-1 file with tempo, program and correctly timed notes', () => {
    const bytes = writeMidi({
      bpm: 120,
      ppq: 480,
      tracks: [
        {
          name: 'm',
          channel: 2,
          program: 12,
          notes: [
            { midi: 60, startSec: 0, durationSec: 0.5, velocity: 1 },
            { midi: 64, startSec: 0.5, durationSec: 0.25, velocity: 0.5 },
          ],
        },
      ],
    })
    const { format, trackCount, ppq, events } = parseMidi(bytes)
    expect([format, trackCount, ppq]).toEqual([1, 2, 480])
    const tempo = events.find((e) => e.status === 0xff && e.data[0] === 0x51)!
    expect(tempo.data.slice(1)).toEqual([0x07, 0xa1, 0x20]) // 500,000 µs per quarter = 120 BPM
    expect(events.find((e) => e.status === 0xc2)?.data).toEqual([12])
    const notes = events.filter((e) => (e.status & 0xf0) === 0x90 || (e.status & 0xf0) === 0x80)
    expect(notes.map((e) => [e.tick, e.status, e.data[0], e.data[1]])).toEqual([
      [0, 0x92, 60, 127],
      [480, 0x82, 60, 0], // off before the next on at the same tick
      [480, 0x92, 64, 64],
      [720, 0x82, 64, 0],
    ])
  })
})

describe('performanceToMidi', () => {
  it('exports logged notes with the instrument program and an optional drone track', () => {
    const config = { ...getPreset('lydian-dream')!.config }
    const log = new PerformanceLog()
    log.record({ index: 0, digit: 3, note: 'D4', durationSec: 0.8, velocity: 0.85, delayMs: 441 })
    log.record({ index: 1, digit: 0, note: null, durationSec: 0, velocity: 0, delayMs: 441 })
    log.record({ index: 2, digit: 4, note: 'E4', durationSec: 0.8, velocity: 0.68, delayMs: 441 })
    const { trackCount, events } = parseMidi(performanceToMidi(log.notes, config))
    expect(trackCount).toBe(3) // conductor, melody, drone
    expect(events.find((e) => e.track === 1 && (e.status & 0xf0) === 0xc0)?.data).toEqual([
      GENERAL_MIDI_PROGRAM['electric-piano'],
    ])
    const ons = events.filter((e) => (e.status & 0xf0) === 0x90)
    expect(ons.filter((e) => e.track === 1).map((e) => e.data[0])).toEqual([62, 64])
    expect(ons.filter((e) => e.track === 2).map((e) => e.data[0])).toEqual([41, 48]) // F2 + C3
  })

  it('has a General MIDI program for every instrument', () => {
    for (const id of INSTRUMENT_IDS) expect(GENERAL_MIDI_PROGRAM[id]).toBeGreaterThanOrEqual(0)
  })
})
