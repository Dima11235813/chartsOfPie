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
  dispose(): void
}

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

  const applyMute = () => {
    if (tone) tone.getDestination().mute = muted
  }

  return {
    async start(initial) {
      settings = initial
      tone ??= await import('tone')
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
    dispose() {
      chain?.dispose()
      chain = null
      chainPromise = null
      lastTime = null
    },
  }
}
