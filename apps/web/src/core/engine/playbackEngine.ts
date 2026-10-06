import { DigitCounter } from '../digits/digitCounter'
import type { DigitSource } from '../digits/digitSource'

/** How one digit should sound; produced by an arranger (see `composition/arranger.ts`). */
export interface ArrangedStep {
  /** Note name, or null for a rest. */
  readonly note: string | null
  readonly durationLabel: string
  readonly durationSec: number
  readonly velocity: number
  /** Wait before the next digit, in ms. */
  readonly delayMs: number
}

export interface StepEvent extends ArrangedStep {
  /** Zero-based position of the digit in the source. */
  readonly index: number
  readonly digit: number
  /** Counts per digit after this step (index = digit). */
  readonly counts: readonly number[]
  /** Digits processed so far, including this one. */
  readonly total: number
}

export interface Scheduler {
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
  /**
   * Optional monotonic clock in ms. When present the engine aims each tick at an absolute target
   * time, so timer lateness does not accumulate into tempo drift.
   */
  now?(): number
}

export const timeoutScheduler: Scheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
}

/** Beyond this lateness (e.g. a throttled background tab) the engine re-anchors instead of rushing. */
const MAX_CATCH_UP_MS = 250

export interface PlaybackEngineOptions {
  source: DigitSource
  /** Decide how a digit sounds and how long to wait before the next one. */
  arrange: (digit: number, index: number) => ArrangedStep
  scheduler?: Scheduler
  onStep?: (event: StepEvent) => void
  onStateChange?: (playing: boolean) => void
}

/**
 * Steps through a digit source one digit at a time: count it, arrange it into a note, notify
 * listeners, then wait as long as the arrangement says before the next digit. Rendering and audio live in the listeners so the engine stays
 * pure and deterministic under a fake scheduler.
 */
export class PlaybackEngine {
  private readonly counter = new DigitCounter()
  private readonly scheduler: Scheduler
  private position = 0
  private playing = false
  private pending: unknown = null
  private lastDelayMs = 0
  private nextTargetMs: number | null = null

  constructor(private options: PlaybackEngineOptions) {
    this.scheduler = options.scheduler ?? timeoutScheduler
  }

  get isPlaying(): boolean {
    return this.playing
  }

  /** Index of the next digit to be played. */
  get nextIndex(): number {
    return this.position
  }

  get isFinished(): boolean {
    return this.position >= this.options.source.length
  }

  get counts(): number[] {
    return this.counter.counts
  }

  play(): void {
    if (this.playing || this.isFinished) return
    this.setPlaying(true)
    this.nextTargetMs = null
    this.tick()
  }

  pause(): void {
    if (!this.playing) return
    this.cancelPending()
    this.setPlaying(false)
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  /** The digits being played. */
  get source(): DigitSource {
    return this.options.source
  }

  /**
   * Play a different source from its first digit (e.g. π from another starting point): stops,
   * and clears the position and counts.
   */
  setSource(source: DigitSource): void {
    this.reset()
    this.options = { ...this.options, source }
  }

  /** Stop and return to the first digit with empty counts. */
  reset(): void {
    this.pause()
    this.position = 0
    this.counter.reset()
  }

  /** Advance exactly one digit (also usable while paused, e.g. for a "step" button). */
  step(): StepEvent | null {
    if (this.isFinished) return null
    const index = this.position
    const digit = this.options.source.digitAt(index)
    this.counter.record(digit)
    this.position += 1
    const arranged = this.options.arrange(digit, index)
    this.lastDelayMs = arranged.delayMs
    const event: StepEvent = {
      ...arranged,
      index,
      digit,
      counts: this.counter.counts,
      total: this.counter.total,
    }
    this.options.onStep?.(event)
    return event
  }

  dispose(): void {
    this.cancelPending()
    this.playing = false
  }

  private tick = (): void => {
    this.pending = null
    if (!this.playing) return
    this.step()
    if (this.isFinished) {
      this.setPlaying(false)
      return
    }
    this.pending = this.scheduler.schedule(this.tick, this.compensatedDelay(this.lastDelayMs))
  }

  private compensatedDelay(delayMs: number): number {
    const now = this.scheduler.now?.()
    if (now === undefined) return delayMs
    let target = (this.nextTargetMs ?? now) + delayMs
    if (now - (target - delayMs) > MAX_CATCH_UP_MS) target = now + delayMs
    this.nextTargetMs = target
    return Math.max(0, target - now)
  }

  private cancelPending(): void {
    if (this.pending !== null) {
      this.scheduler.cancel(this.pending)
      this.pending = null
    }
  }

  private setPlaying(playing: boolean): void {
    this.playing = playing
    this.options.onStateChange?.(playing)
  }
}
