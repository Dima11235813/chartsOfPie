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
  'electric-guitar': -8,
  'acoustic-guitar': -2.3,
  wurlitzer: 5.3,
  clavinet: -10.6,
  organ: -13.7,
  'analog-synth': -11.4,
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

/**
 * Electric guitar: a picked string into a valve amp and a speaker cabinet. The string is a slightly
 * detuned saw (rich in harmonics, like a steel string) whose filter closes after the pick attack;
 * the pickup's resonance adds a mid bump; a soft-clipping amp adds light overdrive; the cabinet
 * removes rumble and the fizz above ~4.5 kHz that real guitar speakers cannot reproduce.
 */
const electricGuitar: InstrumentDefinition = {
  id: 'electric-guitar',
  name: 'Electric guitar',
  description: 'Picked strings through a lightly overdriven amp and speaker cabinet',
  async create(tone) {
    const synth = new tone.PolySynth(tone.MonoSynth, {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 7 },
      envelope: { attack: 0.002, decay: 2.4, sustain: 0.18, release: 0.5 },
      filter: { type: 'lowpass', Q: 1.5, rolloff: -24 },
      filterEnvelope: {
        attack: 0.001,
        decay: 0.45,
        sustain: 0.3,
        release: 0.5,
        baseFrequency: 450,
        octaves: 3.2,
      },
    })
    synth.maxPolyphony = 24
    const pickup = new tone.Filter({ type: 'peaking', frequency: 1400, Q: 1.1, gain: 5 })
    const amp = new tone.Distortion({ distortion: 0.3, oversample: '2x' })
    const cabinetLow = new tone.Filter({ type: 'highpass', frequency: 90, Q: 0.7 })
    const cabinetHigh = new tone.Filter({ type: 'lowpass', frequency: 4500, rolloff: -24, Q: 0.8 })
    return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['electric-guitar'], [
      pickup,
      amp,
      cabinetLow,
      cabinetHigh,
    ])
  },
}

/**
 * Classic keyboards and more strings (R-008). All synthesised: each recipe names what makes the
 * real instrument recognisable and the synthesis that imitates it.
 */
const classics: InstrumentDefinition[] = [
  {
    id: 'acoustic-guitar',
    name: 'Acoustic guitar',
    description: 'Steel strings on a wooden body: bright pick, warm body resonances, quick decay',
    async create(tone) {
      // Plucked string: saw + triangle with a filter that closes right after the pick.
      const synth = new tone.PolySynth(tone.MonoSynth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 4 },
        envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 0.9 },
        filter: { type: 'lowpass', Q: 0.8, rolloff: -24 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.22,
          sustain: 0.12,
          release: 0.6,
          baseFrequency: 600,
          octaves: 3.6,
        },
      })
      synth.maxPolyphony = 24
      // Body: the air resonance (~100 Hz) and top-plate resonance (~220 Hz), a little sparkle.
      const air = new tone.Filter({ type: 'peaking', frequency: 105, Q: 2, gain: 6 })
      const top = new tone.Filter({ type: 'peaking', frequency: 220, Q: 1.5, gain: 4 })
      const sparkle = new tone.Filter({ type: 'peaking', frequency: 3200, Q: 0.9, gain: 3 })
      const lowCut = new tone.Filter({ type: 'highpass', frequency: 70 })
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['acoustic-guitar'], [
        air,
        top,
        sparkle,
        lowCut,
      ])
    },
  },
  {
    id: 'wurlitzer',
    name: 'Wurlitzer',
    description:
      'Reed electric piano: hollow, reedy and a little growly, with its built-in tremolo',
    async create(tone) {
      // A struck steel reed: odd harmonics (square-ish modulator), more bite when played hard.
      const synth = new tone.PolySynth(tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 4,
        oscillator: { type: 'sine' },
        modulation: { type: 'square' },
        envelope: { attack: 0.003, decay: 1.4, sustain: 0.25, release: 0.7 },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.1, release: 0.5 },
      })
      synth.maxPolyphony = 24
      const drive = new tone.Chebyshev({ order: 3, wet: 0.18 })
      const tone_ = new tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
      const tremolo = new tone.Tremolo({ frequency: 5.5, depth: 0.35, spread: 0 }).start()
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB.wurlitzer, [drive, tone_, tremolo])
    },
  },
  {
    id: 'clavinet',
    name: 'Clavinet',
    description: 'Hohner Clavinet: bright, percussive, funky “quack” from a hammered, muted string',
    async create(tone) {
      // Narrow pulse wave (string near the pickup) through a resonant, quickly closing filter.
      const synth = new tone.PolySynth(tone.MonoSynth, {
        oscillator: { type: 'pulse', width: 0.72 },
        envelope: { attack: 0.001, decay: 0.55, sustain: 0.08, release: 0.12 },
        filter: { type: 'lowpass', Q: 2.5, rolloff: -12 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.12,
          sustain: 0.25,
          release: 0.1,
          baseFrequency: 700,
          octaves: 3,
        },
      })
      synth.maxPolyphony = 24
      const thin = new tone.Filter({ type: 'highpass', frequency: 160 })
      const presence = new tone.Filter({ type: 'lowpass', frequency: 6000 })
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB.clavinet, [thin, presence])
    },
  },
  {
    id: 'organ',
    name: 'Organ (drawbars)',
    description: 'Hammond-style drawbar organ (88 8000 000-ish) through a Leslie-like chorus',
    async create(tone) {
      // Drawbars are sine partials: 8′ fundamental, 4′ (2×), 2⅔′ (3×), 2′ (4×), 1⅗′ (5×)…
      const synth = new tone.PolySynth(tone.Synth, {
        oscillator: { type: 'custom', partials: [1, 0.8, 0.5, 0.45, 0.15, 0.25] },
        envelope: { attack: 0.006, decay: 0.05, sustain: 1, release: 0.08 },
      })
      synth.maxPolyphony = 24
      const leslie = new tone.Chorus({ frequency: 5.8, delayTime: 3, depth: 0.5, wet: 0.5 }).start()
      const warmth = new tone.Filter({ type: 'lowpass', frequency: 5000 })
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB.organ, [warmth, leslie])
    },
  },
  {
    id: 'analog-synth',
    name: 'Analog synth lead',
    description: 'Minimoog-style: detuned saws into a resonant 24 dB low-pass with a filter sweep',
    async create(tone) {
      const synth = new tone.PolySynth(tone.MonoSynth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 14 },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.35 },
        filter: { type: 'lowpass', Q: 4, rolloff: -24 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.45,
          sustain: 0.35,
          release: 0.4,
          baseFrequency: 300,
          octaves: 3.5,
        },
      })
      synth.maxPolyphony = 24
      return polyVoice(tone, synth, INSTRUMENT_TRIM_DB['analog-synth'])
    },
  },
]

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
      // Wait for this sampler's own onload: `tone.loaded()` can resolve before every sample is
      // decoded, and the Sampler then re-pitches notes from a more distant sample (audibly worse,
      // and it made the first offline render differ from later ones).
      let sampler!: ToneNamespace.Sampler
      await new Promise<void>((resolve, reject) => {
        sampler = new tone.Sampler({
          urls: salamanderUrls(),
          baseUrl: `${import.meta.env.BASE_URL}audio/salamander/`,
          release: 1.2,
          onload: () => resolve(),
          onerror: (error) => reject(error),
        })
      })
      const output = new tone.Gain(tone.dbToGain(INSTRUMENT_TRIM_DB.piano))
      sampler.connect(output)
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
    name: 'Electric piano (Rhodes-style)',
    description: 'Soft FM “tine” piano in the spirit of a Fender Rhodes',
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
  electricGuitar,
  ...classics,
]

export function getInstrument(id: InstrumentId): InstrumentDefinition {
  const instrument = INSTRUMENTS.find((i) => i.id === id)
  if (!instrument) throw new Error(`Unknown instrument: ${id}`)
  return instrument
}
