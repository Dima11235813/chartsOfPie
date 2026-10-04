import { useCallback, useEffect, useRef, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { loadPiDigits } from '../core/digits/pi'
import { PlaybackEngine, type StepEvent } from '../core/engine/playbackEngine'
import { Arranger } from '../core/composition/arranger'
import type { CompositionConfig } from '../core/composition/config'
import { PerformanceLog, type CoincidentChord } from '../core/composition/performanceLog'
import type { NotePlayer } from '../audio/notePlayer'
import { soundSettingsFor } from '../audio/settings'

export const RECENT_DIGITS = 32
/** Resuming replays digits silently to rebuild counts and views; cap it to stay responsive. */
export const MAX_RESUME_DIGITS = 100_000
const EMPTY_COUNTS: readonly number[] = new Array<number>(10).fill(0)

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; source: DigitSource }
  | { status: 'error'; message: string }

export interface PlaybackState {
  load: LoadState
  isPlaying: boolean
  isFinished: boolean
  counts: readonly number[]
  total: number
  lastStep: StepEvent | null
  /** Most recent digits, oldest first, as [index, digit] pairs. */
  recent: readonly (readonly [number, number])[]
  muted: boolean
  audioError: string | null
  /** True once audio has started, i.e. analysers and recording streams are available. */
  audioReady: boolean
  /** Everything played so far (sheet music, chord spotting, MIDI export). */
  log: PerformanceLog
  /** The most recent chord formed by overlapping notes. */
  lastChord: CoincidentChord | null
  toggle: () => Promise<void>
  step: () => Promise<void>
  reset: () => void
  /**
   * Jump to digit `index` (resume a saved piece): starts over and replays the first `index` digits
   * silently with `config`, so counts, the log and every view are exactly as if they had played.
   */
  seek: (index: number, config?: CompositionConfig) => void
  setMuted: (muted: boolean) => void
}

export function usePiPlayback(
  player: NotePlayer,
  config: CompositionConfig,
  loadSource: () => Promise<DigitSource> = loadPiDigits,
): PlaybackState {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [lastStep, setLastStep] = useState<StepEvent | null>(null)
  const [recent, setRecent] = useState<readonly (readonly [number, number])[]>([])
  const [muted, setMutedState] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [log] = useState(() => new PerformanceLog())
  const [lastChord, setLastChord] = useState<CoincidentChord | null>(null)
  const engineRef = useRef<PlaybackEngine | null>(null)
  const configRef = useRef(config)
  const [arranger] = useState(() => new Arranger(config))
  const gapRef = useRef(0)
  const silentRef = useRef(false)

  // Config changes apply from the next digit on, without restarting playback.
  useEffect(() => {
    configRef.current = config
    arranger.setConfig(config)
    void player.update(soundSettingsFor(config))
  }, [config, arranger, player])

  useEffect(() => {
    let cancelled = false
    loadSource()
      .then((source) => {
        if (cancelled) return
        engineRef.current = new PlaybackEngine({
          source,
          arrange: (digit) => arranger.arrange(digit),
          onStep: (event) => {
            if (!silentRef.current) {
              player.playStep(event.note, event.durationSec, event.velocity, gapRef.current)
            }
            gapRef.current = event.delayMs
            const chord = log.record(event)
            if (chord) setLastChord(chord)
            setLastStep(event)
            setRecent((prev) =>
              [...prev, [event.index, event.digit] as const].slice(-RECENT_DIGITS),
            )
            setIsFinished(event.index === source.length - 1)
          },
          onStateChange: (playing) => {
            setIsPlaying(playing)
            if (!playing) player.stop()
          },
        })
        setLoad({ status: 'ready', source })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      cancelled = true
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [player, loadSource, arranger, log])

  useEffect(() => () => player.dispose(), [player])

  const ensureAudio = useCallback(async () => {
    try {
      await player.start(soundSettingsFor(configRef.current))
      setAudioError(null)
      setAudioReady(true)
    } catch (error) {
      // Keep visualising even if audio is unavailable (e.g. blocked or unsupported).
      setAudioError(error instanceof Error ? error.message : String(error))
    }
  }, [player])

  const toggle = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (!engine.isPlaying) {
      await ensureAudio()
      gapRef.current = 0
    }
    engine.toggle()
  }, [ensureAudio])

  const step = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    await ensureAudio()
    engine.pause()
    gapRef.current = 0
    player.stop()
    engine.step()
  }, [ensureAudio, player])

  const reset = useCallback(() => {
    engineRef.current?.reset()
    arranger.reset()
    log.reset()
    player.stop()
    setLastChord(null)
    setLastStep(null)
    setRecent([])
    setIsFinished(false)
  }, [arranger, player, log])

  const seek = useCallback(
    (index: number, nextConfig?: CompositionConfig) => {
      const engine = engineRef.current
      if (!engine || load.status !== 'ready') return
      reset()
      if (nextConfig) {
        configRef.current = nextConfig
        arranger.setConfig(nextConfig)
      }
      const target = Math.min(Math.max(0, Math.floor(index)), MAX_RESUME_DIGITS, load.source.length)
      silentRef.current = true
      try {
        for (let i = 0; i < target; i++) engine.step()
      } finally {
        silentRef.current = false
        gapRef.current = 0
      }
    },
    [load, reset, arranger],
  )

  const setMuted = useCallback(
    (value: boolean) => {
      player.setMuted(value)
      setMutedState(value)
    },
    [player],
  )

  return {
    load,
    isPlaying,
    isFinished,
    counts: lastStep?.counts ?? EMPTY_COUNTS,
    total: lastStep?.total ?? 0,
    lastStep,
    recent,
    muted,
    audioError,
    audioReady,
    log,
    lastChord,
    toggle,
    step,
    reset,
    seek,
    setMuted,
  }
}
