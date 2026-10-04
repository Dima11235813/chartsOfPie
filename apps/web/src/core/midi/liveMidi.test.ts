import {
  allNotesOff,
  audioTimeToPerformanceMs,
  LiveMidiSender,
  midiVelocity,
  noteOff,
  noteOn,
  programChange,
} from './liveMidi'

describe('live MIDI messages (MIDI 1.0)', () => {
  test('note on/off: status 0x9n/0x8n with the channel in the low nibble', () => {
    // Middle C (60) on channel 1 at full velocity; channel 16 → 0x9F.
    expect(noteOn(1, 60, 1)).toEqual([0x90, 60, 127])
    expect(noteOn(16, 60, 0.5)).toEqual([0x9f, 60, 64])
    expect(noteOff(1, 60)).toEqual([0x80, 60, 0])
  })

  test('velocity never becomes 0 (which would be a note-off)', () => {
    expect(midiVelocity(0)).toBe(1)
    expect(midiVelocity(2)).toBe(127)
  })

  test('program change is 1–128 on the instrument, 0–127 on the wire', () => {
    expect(programChange(1, 1)).toEqual([0xc0, 0])
    expect(programChange(2, 128)).toEqual([0xc1, 127])
  })

  test('panic sends sustain off and All Notes Off (CC 64, CC 123)', () => {
    expect(allNotesOff(1)).toEqual([
      [0xb0, 64, 0],
      [0xb0, 123, 0],
    ])
  })
})

describe('LiveMidiSender', () => {
  const setup = () => {
    const sent: { bytes: number[]; at?: number }[] = []
    const sender = new LiveMidiSender((bytes, at) => sent.push({ bytes, at }), {
      channel: 1,
      latencyMs: 10,
    })
    return { sent, sender }
  }

  test('schedules note on and off at the right times, shifted by the latency', () => {
    const { sent, sender } = setup()
    sender.note(64, 1000, 500, 1)
    expect(sent).toEqual([
      { bytes: [0x90, 64, 127], at: 1010 },
      { bytes: [0x80, 64, 0], at: 1510 },
    ])
  })

  test('re-striking a sounding key releases it just before the new note', () => {
    const { sent, sender } = setup()
    sender.note(64, 1000, 2000, 1)
    sender.note(64, 1500, 200, 1)
    expect(sent.slice(2)).toEqual([
      { bytes: [0x80, 64, 0], at: 1509 },
      { bytes: [0x90, 64, 127], at: 1510 },
      { bytes: [0x80, 64, 0], at: 1710 },
    ])
  })

  test('stop releases held drone notes and sends All Notes Off', () => {
    const { sent, sender } = setup()
    sender.hold([45, 52], 0)
    sent.length = 0
    sender.stop()
    expect(sent.map((m) => m.bytes)).toEqual([
      [0x80, 45, 0],
      [0x80, 52, 0],
      [0xb0, 64, 0],
      [0xb0, 123, 0],
    ])
  })

  test('audio clock → performance clock', () => {
    expect(audioTimeToPerformanceMs(2.5, { contextTime: 2, performanceTime: 10_000 })).toBe(10_500)
  })
})
