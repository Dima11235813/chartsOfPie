import type * as ToneNamespace from 'tone'
import { createSoundChain, type SoundChain, type SoundSettings } from './soundChain'

/** The audio surface the app needs; tests swap in a fake. */
export interface NotePlayer {
  /** Must be called from a user gesture (browser autoplay policy). */
  start(settings: SoundSettings): Promise<void>
  /** Change instrument/effects/drone; safe to call before `start`. */
  update(settings: SoundSettings): Promise<void>
  /**
   * Play one step. `gapMs` is the wait that preceded this step; the player uses it to place notes
   * on an exact audio-clock grid instead of trusting timer jitter. `note` null = rest.
   */
  playStep(note: string | null, durationSec: number, velocity: number, gapMs: number): void
  /** Called on pause: release sounding notes and the drone, forget the timing grid. */
  stop(): void
  setMuted(muted: boolean): void
  /** Live spectrum of the output (null until audio has started). */
  getAnalyser(): FrequencySource | null
  /** Stereo time-domain samples of the output (null until audio has started). */
  getWaveform(): WaveformSource | null
  /** The output as a MediaStream for recording (null until audio has started). */
  getAudioStream(): MediaStream | null
  dispose(): void
}

/** Left/right time-domain samples (−1…1) of the output, for the oscilloscope. */
export interface WaveformSource {
  readonly size: number
  readonly sampleRate: number
  read(left: Float32Array<ArrayBuffer>, right: Float32Array<ArrayBuffer>): void
}

/** The part of an AnalyserNode the spectrogram needs. */
export interface FrequencySource {
  readonly frequencyBinCount: number
  readonly sampleRate: number
  getFloatFrequencyData(target: Float32Array<ArrayBuffer>): void
}

/**
 * Scheduling headroom: notes are scheduled this far ahead, so a busy main thread (a heavy view,
 * GC) can stall this long without making a note late. Tone's default is 0.1 s.
 */
export const LOOK_AHEAD_SEC = 0.15

/** If the ideal grid time drifts further than this from "now", re-anchor to now. */
const MAX_DRIFT_SEC = 0.08

/**
 * Tone.js-backed player. Tone is imported lazily on the first Play click, which keeps it out of the
 * initial bundle and guarantees the AudioContext is created inside a user gesture.
 */
export function createToneNotePlayer(): NotePlayer {
  let tone: typeof ToneNamespace | null = null
  let chain: SoundChain | null = null
  let chainPromise: Promise<SoundChain> | null = null
  let settings: SoundSettings | null = null
  let lastTime: number | null = null
  let muted = false
  let analyser: FrequencySource | null = null
  let waveform: WaveformSource | null = null
  let stream: MediaStream | null = null

  const applyMute = () => {
    if (tone) tone.getDestination().mute = muted
  }

  return {
    async start(initial) {
      settings = initial
      if (!tone) {
        tone = await import('tone')
        // A larger output buffer than "interactive" rides out short CPU spikes without crackles;
        // the extra ~20–40 ms of latency is inaudible for playback.
        tone.setContext(new tone.Context({ latencyHint: 'balanced', lookAhead: LOOK_AHEAD_SEC }))
      }
      await tone.start()
      applyMute()
      chainPromise ??= createSoundChain(tone, initial)
      chain = await chainPromise
      await chain.update(settings)
    },
    async update(next) {
      settings = next
      if (chain) await chain.update(next)
    },
    playStep(note, durationSec, velocity, gapMs) {
      if (!tone || !chain) return
      const now = tone.now()
      let time = lastTime === null ? now : lastTime + gapMs / 1000
      if (Math.abs(time - now) > MAX_DRIFT_SEC) time = now
      // Two attacks at the same audio time are rejected by Tone; keep them strictly increasing.
      if (lastTime !== null && time <= lastTime) time = lastTime + 0.001
      lastTime = time
      chain.startDrone(time)
      if (note === null) return
      try {
        chain.playNote(note, durationSec, time, velocity)
      } catch (error) {
        console.warn('Could not play note', note, error)
      }
    },
    stop() {
      lastTime = null
      chain?.releaseAll(tone?.now())
    },
    setMuted(value) {
      muted = value
      applyMute()
    },
    getAnalyser() {
      if (!tone || !chain) return null
      if (!analyser) {
        const node = tone.getContext().createAnalyser()
        node.fftSize = 4096
        node.smoothingTimeConstant = 0.3
        chain.tap(node)
        analyser = {
          frequencyBinCount: node.frequencyBinCount,
          sampleRate: node.context.sampleRate,
          getFloatFrequencyData: (target) => node.getFloatFrequencyData(target),
        }
      }
      return analyser
    },
    getWaveform() {
      if (!tone || !chain) return null
      if (!waveform) {
        const context = tone.getContext()
        const splitter = context.createChannelSplitter(2)
        const left = context.createAnalyser()
        const right = context.createAnalyser()
        for (const node of [left, right]) {
          node.fftSize = 2048
          node.smoothingTimeConstant = 0
        }
        chain.tap(splitter)
        splitter.connect(left, 0)
        splitter.connect(right, 1)
        waveform = {
          size: left.fftSize,
          sampleRate: context.sampleRate,
          read: (l, r) => {
            left.getFloatTimeDomainData(l)
            right.getFloatTimeDomainData(r)
          },
        }
      }
      return waveform
    },
    getAudioStream() {
      if (!tone || !chain) return null
      if (!stream) {
        const destination = tone.getContext().createMediaStreamDestination()
        chain.tap(destination)
        stream = destination.stream
      }
      return stream
    },
    dispose() {
      chain?.dispose()
      chain = null
      chainPromise = null
      lastTime = null
      analyser = null
      waveform = null
      stream = null
    },
  }
}
