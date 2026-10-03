import type * as ToneNamespace from 'tone'

/** Minimal audio surface the app needs; lets tests swap in a fake. */
export interface NotePlayer {
  /** Must be called from a user gesture (browser autoplay policy). */
  start(): Promise<void>
  playNote(note: string, duration: string): void
  setMuted(muted: boolean): void
  dispose(): void
}

/**
 * Tone.js-backed player. Tone is imported lazily on the first Play click, which keeps it out of the
 * initial bundle and guarantees the AudioContext is created inside a user gesture.
 */
export function createToneNotePlayer(): NotePlayer {
  let tone: typeof ToneNamespace | null = null
  let synth: ToneNamespace.Synth | null = null
  let lastStart = 0
  let muted = false

  return {
    async start() {
      tone ??= await import('tone')
      if (!synth) {
        synth = new tone.Synth().toDestination()
        synth.volume.value = muted ? -Infinity : 0
      }
      await tone.start()
    },
    playNote(note, duration) {
      if (!tone || !synth) return
      // Tone rejects two attacks at the same audio time; the legacy timing can schedule digits 0 ms
      // apart, so nudge each attack strictly after the previous one.
      const time = Math.max(tone.now(), lastStart + 0.001)
      lastStart = time
      try {
        synth.triggerAttackRelease(note, duration, time)
      } catch (error) {
        console.warn('Could not play note', note, duration, error)
      }
    },
    setMuted(value) {
      muted = value
      if (synth) synth.volume.value = value ? -Infinity : 0
    },
    dispose() {
      synth?.dispose()
      synth = null
    },
  }
}
