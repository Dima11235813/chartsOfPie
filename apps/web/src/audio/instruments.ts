import type * as ToneNamespace from 'tone'
import type { InstrumentId } from '../core/composition/config'

type Tone = typeof ToneNamespace

/** A playable instrument plus its own tone shaping, ending in `output`. */
export interface Voice {
  readonly output: ToneNamespace.ToneAudioNode
  play(note: string, durationSec: number, time: number, velocity: number): void
  releaseAll(time?: number): void
  dispose(): void
}

export interface InstrumentDefinition {
  readonly id: InstrumentId
  readonly name: string
  readonly description: string
  /** Builds the voice; resolves once samples (if any) are loaded. */
  create(tone: Tone): Promise<Voice>
}

/**
 * Output trims (dB) so instruments sit at a similar loudness. Calibrated with the offline render
 * harness (`npm run audio:render`) against the Original preset — re-run it after changing any
 * instrument and update these numbers.
 */
export const INSTRUMENT_TRIM_DB: Record<InstrumentId, number> = {
  classic: 0, // legacy level, never trimmed (parity)
  piano: 3.9,
  'electric-piano': -2.7,
  'music-box': -2,
  marimba: 1.4,
  harp: -3.6,
  'warm-pad': -1.6,
  'pure-sine': -15.4,
}

function polyVoice(
  tone: Tone,
  synth: ToneNamespace.PolySynth,
  trimDb: number,
  shaping: ToneNamespace.ToneAudioNode[] = [],
): Voice {
  const output = new tone.Gain(tone.dbToGain(trimDb))
  synth.chain(...shaping, output)
  return {
    output,
    play: (note, durationSec, time, velocity) =>
      synth.triggerAttackRelease(note, durationSec, time, velocity),
    releaseAll: (time) => synth.releaseAll(time),
    dispose: () => {
      synth.dispose()
      shaping.forEach((node) => node.dispose())
      output.dispose()
    },
  }
}

const SALAMANDER_NOTES = ['A', 'C', 'D#', 'F#'] as const

function salamanderUrls(): Record<string, string> {
  const urls: Record<string, string> = {}
  for (let octave = 1; octave <= 7; octave++) {
    for (const name of SALAMANDER_NOTES) {
      const note = `${name}${octave}`
      if ((octave === 1 && name !== 'A') || (octave === 7 && name !== 'C')) continue
      urls[note] = `${note.replace('#', 's')}.mp3`
    }
  }
  return urls
}

export const INSTRUMENTS: readonly InstrumentDefinition[] = [
  {
    id: 'classic',
    name: 'Classic synth',
    description: 'The original single-voice Tone.js synth',
    async create(tone) {
      // Monophonic on purpose: this is the legacy sound, including note cut-offs.
      const synth = new tone.Synth()
      const output = new tone.Gain(tone.dbToGain(INSTRUMENT_TRIM_DB.classic))
      synth.connect(output)
      return {
        output,
        play: (note, durationSec, time, velocity) =>
          synth.triggerAttackRelease(note, durationSec, time, velocity),
        releaseAll: (time) => synth.triggerRelease(time),
        dispose: () => {
          synth.dispose()
          output.dispose()
        },
      }
    },
  },
  {
    id: 'piano',
    name: 'Grand piano',
    description: 'Sampled Yamaha grand (Salamander, CC BY 3.0)',
    async create(tone) {
      const sampler = new tone.Sampler({
        urls: salamanderUrls(),
        baseUrl: `${import.meta.env.BASE_URL}audio/salamander/`,
        release: 1.2,
      })
      const output = new tone.Gain(tone.dbToGain(INSTRUMENT_TRIM_DB.piano))
      sampler.connect(output)
      await tone.loaded()
      return {
        output,
        play: (note, durationSec, time, velocity) =>
          sampler.triggerAttackRelease(note, Math.max(durationSec, 0.25), time, velocity),
        releaseAll: (time) => sampler.releaseAll(time),
        dispose: () => {
          sampler.dispose()
          output.dispose()
        },
      }
    },
  },
  {
    id: 'electric-piano',
    name: 'Electric piano',
    description: 'Soft FM “tine” piano',
    async create(tone) {
      const synth = new tone.PolySynth(tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.6, sustain: 0.2, release: 1.4 },
        modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.05, release: 0.8 },
      })
      synth.maxPolyphony = 24
      const tone_ = new tone.Filter(3200, 'lowpass')
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['electric-piano'], [tone_])
    },
  },
  {
    id: 'music-box',
    name: 'Music box',
    description: 'Delicate bell-like FM tines',
    async create(tone) {
      const synth = new tone.PolySynth(tone.FMSynth, {
        harmonicity: 5,
        modulationIndex: 2.5,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 1.6 },
        modulationEnvelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.3 },
      })
      synth.maxPolyphony = 24
      const shaping = new tone.Filter(5000, 'lowpass')
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['music-box'], [shaping])
    },
  },
  {
    id: 'marimba',
    name: 'Marimba',
    description: 'Woody mallet tone (FM, 4:1 overtone like a real marimba bar)',
    async create(tone) {
      const synth = new tone.PolySynth(tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 1.2,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
        modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
      })
      synth.maxPolyphony = 24
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB.marimba)
    },
  },
  {
    id: 'harp',
    name: 'Plucked strings',
    description: 'Harp-like pluck: bright attack that mellows as it rings',
    async create(tone) {
      // Subtractive pluck: a filter envelope closing quickly over a triangle+saw blend. (Tone's
      // Karplus–Strong PluckSynth was tried: its onset peak is ~23 dB above its body, so it could
      // not be levelled without clipping — see proj-mgmt/research/R-005.)
      const synth = new tone.PolySynth(tone.MonoSynth, {
        oscillator: { type: 'fattriangle', count: 2, spread: 8 },
        envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1.2 },
        filter: { type: 'lowpass', Q: 1, rolloff: -24 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.35,
          sustain: 0.15,
          release: 0.8,
          baseFrequency: 350,
          octaves: 3.5,
        },
      })
      synth.maxPolyphony = 24
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB.harp)
    },
  },
  {
    id: 'warm-pad',
    name: 'Warm pad',
    description: 'Slow, detuned analogue-style pad',
    async create(tone) {
      const synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 2.5 },
      })
      synth.maxPolyphony = 24
      const filter = new tone.Filter({ frequency: 1100, type: 'lowpass', Q: 0.5 })
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['warm-pad'], [filter])
    },
  },
  {
    id: 'pure-sine',
    name: 'Pure sine',
    description: 'A plain sine wave — just the frequency',
    async create(tone) {
      const synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.5 },
      })
      synth.maxPolyphony = 24
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['pure-sine'])
    },
  },
]

export function getInstrument(id: InstrumentId): InstrumentDefinition {
  const instrument = INSTRUMENTS.find((i) => i.id === id)
  if (!instrument) throw new Error(`Unknown instrument: ${id}`)
  return instrument
}
