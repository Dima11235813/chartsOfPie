import { useCallback, useEffect, useRef, useState } from 'react'
import { windowFrom, type DigitSource } from '../core/digits/digitSource'
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
  /**
   * `source` is what plays: π from the current starting point (index 0 = decimal place `start`).
   * `full` is all the digits loaded, whatever their number.
   */
  | { status: 'ready'; source: DigitSource; full: DigitSource; start: number }
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
   * `start` (default: keep the current one) moves the starting point first.
   */
  seek: (index: number, config?: CompositionConfig, start?: number) => void
  /** Start over from decimal place `start` of π (0 = the beginning). */
  startAt: (start: number) => void
  setMuted: (muted: boolean) => void
}

export function usePiPlayback(
  player: NotePlayer,
  config: CompositionConfig,
  loadSource: () => Promise<DigitSource> = loadPiDigits,
  /** Starting point once the digits have loaded (e.g. from a share link). */
  initialStart = 0,
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
  const initialStartRef = useRef(initialStart)

  // A new source (another number) starts from the latest requested starting point.
  useEffect(() => {
    initialStartRef.current = initialStart
  }, [initialStart])

  // Config changes apply from the next digit on, without restarting playback.
  useEffect(() => {
    configRef.current = config
    arranger.setConfig(config)
    void player.update(soundSettingsFor(config))
  }, [config, arranger, player])

  useEffect(() => {
    let cancelled = false
    loadSource()
      .then((full) => {
        if (cancelled) return
        // Another number replaces the one playing: start over with empty counts and views.
        arranger.reset()
        log.reset()
        setLastChord(null)
        setLastStep(null)
        setRecent([])
        setIsFinished(false)
        const start = clampStart(initialStartRef.current, full)
        const source = windowFrom(full, start)
        engineRef.current = new PlaybackEngine({
          source,
          arrange: (digit, index) => arranger.arrange(digit, index),
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
            setIsFinished(event.index === engineRef.current!.source.length - 1)
          },
          onStateChange: (playing) => {
            setIsPlaying(playing)
            if (!playing) player.stop()
          },
        })
        setLoad({ status: 'ready', source, full, start })
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
      engineRef.current?.pause()
      engineRef.current?.dispose()
      engineRef.current = null
      setLoad({ status: 'loading' })
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

  const startAt = useCallback(
    (start: number) => {
      const engine = engineRef.current
      if (!engine || load.status !== 'ready') return
      reset()
      const at = clampStart(start, load.full)
      if (at === load.start) return
      const source = windowFrom(load.full, at)
      engine.setSource(source)
      setLoad({ status: 'ready', source, full: load.full, start: at })
    },
    [load, reset],
  )

  const seek = useCallback(
    (index: number, nextConfig?: CompositionConfig, start?: number) => {
      const engine = engineRef.current
      if (!engine || load.status !== 'ready') return
      reset()
      if (start !== undefined && clampStart(start, load.full) !== load.start) {
        const at = clampStart(start, load.full)
        engine.setSource(windowFrom(load.full, at))
        setLoad({ status: 'ready', source: engine.source, full: load.full, start: at })
      }
      if (nextConfig) {
        configRef.current = nextConfig
        arranger.setConfig(nextConfig)
      }
      const target = Math.min(
        Math.max(0, Math.floor(index)),
        MAX_RESUME_DIGITS,
        engine.source.length,
      )
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
    startAt,
    setMuted,
  }
}

/** A starting point inside the data: a whole decimal place with at least one digit after it. */
export function clampStart(start: number, full: DigitSource): number {
  if (!Number.isFinite(start)) return 0
  return Math.min(Math.max(0, Math.floor(start)), full.length - 1)
}
