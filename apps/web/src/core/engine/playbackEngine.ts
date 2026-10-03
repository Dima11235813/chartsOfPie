import { DigitCounter } from '../digits/digitCounter'
import type { DigitSource } from '../digits/digitSource'

export interface StepEvent {
  /** Zero-based position of the digit in the source. */
  readonly index: number
  readonly digit: number
  readonly note: string
  readonly duration: string
  /** Counts per digit after this step (index = digit). */
  readonly counts: readonly number[]
  /** Digits processed so far, including this one. */
  readonly total: number
}

export interface Scheduler {
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
}

export const timeoutScheduler: Scheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface PlaybackEngineOptions {
  source: DigitSource
  noteForDigit: (digit: number) => string
  durationForDigit: (digit: number) => string
  /** Wait before the following digit, in ms. */
  nextDelayMs: () => number
  scheduler?: Scheduler
  onStep?: (event: StepEvent) => void
  onStateChange?: (playing: boolean) => void
}

/**
 * Steps through a digit source one digit at a time: count it, map it to a note, notify listeners,
 * then wait before the next digit. Rendering and audio live in the listeners so the engine stays
 * pure and deterministic under a fake scheduler.
 */
export class PlaybackEngine {
  private readonly counter = new DigitCounter()
  private readonly scheduler: Scheduler
  private position = 0
  private playing = false
  private pending: unknown = null

  constructor(private readonly options: PlaybackEngineOptions) {
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
    const event: StepEvent = {
      index,
      digit,
      note: this.options.noteForDigit(digit),
      duration: this.options.durationForDigit(digit),
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
    this.pending = this.scheduler.schedule(this.tick, this.options.nextDelayMs())
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
