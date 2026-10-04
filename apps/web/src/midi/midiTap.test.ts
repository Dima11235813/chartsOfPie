import type { NotePlayer } from '../audio/notePlayer'
import { LiveMidiSender } from '../core/midi/liveMidi'
import { AUDIO_LEAD_MS, withMidiTap } from './midiTap'

const fakePlayer = () =>
  ({
    start: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    playStep: vi.fn(),
    stop: vi.fn(),
    setMuted: vi.fn(),
    getAnalyser: vi.fn(() => null),
    getWaveform: vi.fn(() => null),
    getAudioStream: vi.fn(() => null),
    dispose: vi.fn(),
  }) satisfies NotePlayer

const settings = {
  instrument: 'piano' as const,
  reverb: 0,
  echo: 0,
  volume: 0,
  drone: ['A2', 'E3'],
  bpm: 120,
  compress: false,
}

test('notes go to the built-in player and to MIDI on the same grid', async () => {
  const inner = fakePlayer()
  let clock = 1000
  const tapped = withMidiTap(inner, () => clock)
  const sent: { bytes: number[]; at?: number }[] = []
  tapped.setRoute({
    sender: new LiveMidiSender((bytes, at) => sent.push({ bytes, at }), {
      channel: 1,
      latencyMs: 0,
    }),
    internalSound: true,
  })
  await tapped.start(settings)
  tapped.playStep('C4', 0.5, 1, 0)
  clock += 260 // timer jitter: 10 ms late
  tapped.playStep('E4', 0.5, 1, 250)
  tapped.playStep(null, 0.5, 1, 250) // a rest sends nothing

  expect(inner.playStep).toHaveBeenCalledTimes(3)
  const start = 1000 + AUDIO_LEAD_MS
  expect(sent.filter((m) => m.bytes[0] === 0x90)).toEqual([
    { bytes: [0x90, 45, 57], at: start }, // drone A2, held
    { bytes: [0x90, 52, 57], at: start }, // drone E3
    { bytes: [0x90, 60, 127], at: start },
    { bytes: [0x90, 64, 127], at: start + 250 }, // on the grid, not 260
  ])

  sent.length = 0
  tapped.stop()
  expect(inner.stop).toHaveBeenCalled()
  expect(sent.map((m) => m.bytes)).toContainEqual([0xb0, 123, 0])
})

test('"MIDI only" silences the built-in sound; removing the route restores it', () => {
  const inner = fakePlayer()
  const tapped = withMidiTap(inner)
  const sender = new LiveMidiSender(() => {}, { channel: 1, latencyMs: 0 })
  tapped.setRoute({ sender, internalSound: false })
  expect(inner.setMuted).toHaveBeenLastCalledWith(true)
  tapped.setRoute(null)
  expect(inner.setMuted).toHaveBeenLastCalledWith(false)
  tapped.setMuted(true)
  expect(inner.setMuted).toHaveBeenLastCalledWith(true)
})
