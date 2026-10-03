import { useCallback, useEffect, useRef, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { loadPiDigits } from '../core/digits/pi'
import { PlaybackEngine, type StepEvent } from '../core/engine/playbackEngine'
import {
  legacyDurationForDigit,
  legacyNoteForDigit,
  legacyStepDelayMs,
} from '../core/music/legacyMapping'
import type { NotePlayer } from '../audio/toneAudio'

export const RECENT_DIGITS = 32
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
  toggle: () => Promise<void>
  step: () => Promise<void>
  reset: () => void
  setMuted: (muted: boolean) => void
}

export function usePiPlayback(
  player: NotePlayer,
  loadSource: () => Promise<DigitSource> = loadPiDigits,
): PlaybackState {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [lastStep, setLastStep] = useState<StepEvent | null>(null)
  const [recent, setRecent] = useState<readonly (readonly [number, number])[]>([])
  const [muted, setMutedState] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const engineRef = useRef<PlaybackEngine | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSource()
      .then((source) => {
        if (cancelled) return
        engineRef.current = new PlaybackEngine({
          source,
          noteForDigit: legacyNoteForDigit,
          durationForDigit: legacyDurationForDigit,
          nextDelayMs: () => legacyStepDelayMs(),
          onStep: (event) => {
            player.playNote(event.note, event.duration)
            setLastStep(event)
            setRecent((prev) =>
              [...prev, [event.index, event.digit] as const].slice(-RECENT_DIGITS),
            )
            setIsFinished(event.index === source.length - 1)
          },
          onStateChange: setIsPlaying,
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
  }, [player, loadSource])

  useEffect(() => () => player.dispose(), [player])

  const ensureAudio = useCallback(async () => {
    try {
      await player.start()
      setAudioError(null)
    } catch (error) {
      // Keep visualising even if audio is unavailable (e.g. blocked or unsupported).
      setAudioError(error instanceof Error ? error.message : String(error))
    }
  }, [player])

  const toggle = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (!engine.isPlaying) await ensureAudio()
    engine.toggle()
  }, [ensureAudio])

  const step = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    await ensureAudio()
    engine.pause()
    engine.step()
  }, [ensureAudio])

  const reset = useCallback(() => {
    engineRef.current?.reset()
    setLastStep(null)
    setRecent([])
    setIsFinished(false)
  }, [])

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
    toggle,
    step,
    reset,
    setMuted,
  }
}
