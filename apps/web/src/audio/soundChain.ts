import type * as ToneNamespace from 'tone'
import type { InstrumentId } from '../core/composition/config'
import { CEILING_RANGE, ceilingCurve, ceilingMode, SAFETY, SOFT_CLIP, TRANSPARENT } from './ceiling'
import { getInstrument, type Voice } from './instruments'

type Tone = typeof ToneNamespace

export interface SoundSettings {
  instrument: InstrumentId
  /** 0–1 send levels. */
  reverb: number
  echo: number
  /** Master offset, dB. */
  volume: number
  /** Notes for the drone, or null for none. */
  drone: readonly string[] | null
  /** Used to time the echo to the beat. */
  bpm: number
  /** Master glue compression + soft-clip ceiling. */
  compress: boolean
}

/**
 * The audio graph shared by live playback and offline rendering:
 *
 *   voice ─┬─────────────── master ── glue ── makeup ── limiter ── ceiling ── destination
 *          ├─ reverb send ─ reverb ─┘
 *          └─ echo send ── delay ──┘        drone ─ (master + reverb send)
 *
 * With `compress` off, glue (ratio 1) is transparent and so is the ceiling at the bare level,
 * which keeps the Original preset's 2019 signal path; once volume, reverb, echo or a drone is added
 * the ceiling rounds off peaks instead of letting them hard-clip (B-019, see ceiling.ts).
 */
export interface SoundChain {
  playNote(note: string, durationSec: number, time: number, velocity: number): void
  update(settings: SoundSettings): Promise<void>
  startDrone(time: number): void
  stopDrone(time?: number): void
  releaseAll(time?: number): void
  /** Also send the final mix (before mute) to `node`, e.g. an analyser or a recorder. */
  tap(node: AudioNode): void
  dispose(): void
}

const GLUE = { threshold: -24, ratio: 2.5, makeupDb: 2 }

/** Pre-computed ceiling curves (see ceiling.ts). */
const CEILING_CURVES = {
  transparent: ceilingCurve(TRANSPARENT),
  safety: ceilingCurve(SAFETY),
  'soft-clip': ceilingCurve(SOFT_CLIP),
}

const REVERB_SEND_MAX = 0.9
const ECHO_SEND_MAX = 0.5
const RAMP_SEC = 0.05

export async function createSoundChain(tone: Tone, initial: SoundSettings): Promise<SoundChain> {
  const ceiling = new tone.WaveShaper(CEILING_CURVES[ceilingMode(initial)]).toDestination()
  ceiling.oversample = '4x'
  const ceilingInput = new tone.Gain(1 / CEILING_RANGE).connect(ceiling)
  const limiter = new tone.Limiter(-1).connect(ceilingInput)
  const makeup = new tone.Gain(1).connect(limiter)
  const glue = new tone.Compressor({
    threshold: 0,
    ratio: 1,
    attack: 0.01,
    release: 0.25,
    knee: 10,
  })
  glue.connect(makeup)
  const master = new tone.Gain(tone.dbToGain(initial.volume)).connect(glue)
  const reverb = new tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 }).connect(master)
  const reverbSend = new tone.Gain(initial.reverb * REVERB_SEND_MAX).connect(reverb)
  const delay = new tone.FeedbackDelay({ delayTime: 0, feedback: 0.3, wet: 1 })
  const delayTone = new tone.Filter(2500, 'lowpass')
  delay.chain(delayTone, master)
  const echoSend = new tone.Gain(initial.echo * ECHO_SEND_MAX).connect(delay)
  await reverb.ready

  // Low, soft drone: root and fifth an octave below the melody.
  const drone = new tone.PolySynth(tone.Synth, {
    oscillator: { type: 'fattriangle', count: 2, spread: 12 },
    envelope: { attack: 2, decay: 0.5, sustain: 0.8, release: 3 },
  })
  const droneFilter = new tone.Filter(700, 'lowpass')
  const droneGain = new tone.Gain(tone.dbToGain(-22))
  drone.chain(droneFilter, droneGain)
  droneGain.fan(master, reverbSend)

  let voiceId: InstrumentId | null = null
  let voice: Voice | null = null
  let droneNotes: readonly string[] = []
  let droneOn = false

  const setVoice = async (id: InstrumentId) => {
    if (id === voiceId) return
    const next = await getInstrument(id).create(tone)
    next.output.fan(master, reverbSend, echoSend)
    const previous = voice
    voice = next
    voiceId = id
    if (previous) {
      previous.releaseAll()
      // Let tails ring out before disposing.
      setTimeout(() => previous.dispose(), 3000)
    }
  }

  const applyEffects = (s: SoundSettings) => {
    reverbSend.gain.rampTo(s.reverb * REVERB_SEND_MAX, RAMP_SEC)
    echoSend.gain.rampTo(s.echo * ECHO_SEND_MAX, RAMP_SEC)
    master.gain.rampTo(tone.dbToGain(s.volume), RAMP_SEC)
    // Dotted-eighth echo is a classic, musical delay time.
    delay.delayTime.value = (60 / s.bpm) * 0.75
    glue.threshold.value = s.compress ? GLUE.threshold : 0
    glue.ratio.value = s.compress ? GLUE.ratio : 1
    makeup.gain.rampTo(tone.dbToGain(s.compress ? GLUE.makeupDb : 0), RAMP_SEC)
    ceiling.curve = CEILING_CURVES[ceilingMode(s)]
  }

  await setVoice(initial.instrument)
  applyEffects(initial)
  droneNotes = initial.drone ?? []

  const chain: SoundChain = {
    playNote(note, durationSec, time, velocity) {
      voice?.play(note, durationSec, time, velocity)
    },
    async update(next) {
      const droneChanged = (next.drone ?? []).join() !== droneNotes.join()
      await setVoice(next.instrument)
      applyEffects(next)
      if (droneChanged) {
        const wasOn = droneOn
        chain.stopDrone()
        droneNotes = next.drone ?? []
        if (wasOn) chain.startDrone(tone.now())
      }
    },
    startDrone(time) {
      if (droneOn || droneNotes.length === 0) return
      drone.triggerAttack([...droneNotes], time, 0.8)
      droneOn = true
    },
    stopDrone(time) {
      if (!droneOn) return
      drone.releaseAll(time)
      droneOn = false
    },
    releaseAll(time) {
      voice?.releaseAll(time)
      chain.stopDrone(time)
    },
    tap(node) {
      ceiling.connect(node)
    },
    dispose() {
      voice?.dispose()
      for (const node of [
        drone,
        droneFilter,
        droneGain,
        echoSend,
        delay,
        delayTone,
        reverbSend,
        reverb,
        master,
        glue,
        makeup,
        limiter,
        ceilingInput,
        ceiling,
      ]) {
        node.dispose()
      }
    },
  }
  return chain
}
