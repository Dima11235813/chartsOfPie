import { describe, expect, it, vi } from 'vitest'
import { createDigitSource, parseDigits } from '../digits/digitSource'
import { PlaybackEngine, type Scheduler, type StepEvent } from './playbackEngine'

/** Manual scheduler: callbacks run only when the test calls `flush()`. */
function manualScheduler() {
  let queue: { id: number; callback: () => void; delay: number }[] = []
  let nextId = 1
  const scheduler: Scheduler = {
    schedule: (callback, delay) => {
      const id = nextId++
      queue.push({ id, callback, delay })
      return id
    },
    cancel: (handle) => {
      queue = queue.filter((entry) => entry.id !== handle)
    },
  }
  return {
    scheduler,
    get pending() {
      return queue.length
    },
    get delays() {
      return queue.map((q) => q.delay)
    },
    flush() {
      const current = queue
      queue = []
      current.forEach((entry) => entry.callback())
    },
  }
}

function makeEngine(digits = '31415') {
  const clock = manualScheduler()
  const steps: StepEvent[] = []
  const states: boolean[] = []
  const engine = new PlaybackEngine({
    source: createDigitSource('t', 'test', parseDigits(digits)),
    arrange: (d) => ({
      note: `N${d}`,
      durationLabel: `D${d}`,
      durationSec: 0.1,
      velocity: 1,
      delayMs: 84,
    }),
    scheduler: clock.scheduler,
    onStep: (event) => steps.push(event),
    onStateChange: (playing) => states.push(playing),
  })
  return { engine, clock, steps, states }
}

describe('PlaybackEngine', () => {
  it('plays the first digit immediately then one per scheduled tick', () => {
    const { engine, clock, steps } = makeEngine()
    engine.play()
    expect(steps.map((s) => s.digit)).toEqual([3])
    expect(clock.delays).toEqual([84])
    clock.flush()
    clock.flush()
    expect(steps.map((s) => [s.index, s.digit, s.note, s.durationLabel])).toEqual([
      [0, 3, 'N3', 'D3'],
      [1, 1, 'N1', 'D1'],
      [2, 4, 'N4', 'D4'],
    ])
    expect(steps.at(-1)?.counts).toEqual([0, 1, 0, 1, 1, 0, 0, 0, 0, 0])
    expect(steps.at(-1)?.total).toBe(3)
  })

  it('pause cancels the pending tick so resuming never doubles the tempo', () => {
    const { engine, clock, steps, states } = makeEngine()
    engine.play()
    engine.pause()
    expect(clock.pending).toBe(0)
    engine.play()
    expect(clock.pending).toBe(1)
    clock.flush()
    expect(steps).toHaveLength(3)
    expect(clock.pending).toBe(1)
    expect(states).toEqual([true, false, true])
  })

  it('toggle switches between playing and paused', () => {
    const { engine } = makeEngine()
    engine.toggle()
    expect(engine.isPlaying).toBe(true)
    engine.toggle()
    expect(engine.isPlaying).toBe(false)
  })

  it('stops at the end of the source', () => {
    const { engine, clock, steps } = makeEngine('314')
    engine.play()
    clock.flush()
    clock.flush()
    expect(steps).toHaveLength(3)
    expect(engine.isPlaying).toBe(false)
    expect(engine.isFinished).toBe(true)
    expect(clock.pending).toBe(0)
    engine.play()
    expect(engine.isPlaying).toBe(false)
    expect(engine.step()).toBeNull()
  })

  it('reset rewinds and clears counts', () => {
    const { engine } = makeEngine()
    engine.step()
    engine.step()
    engine.reset()
    expect(engine.nextIndex).toBe(0)
    expect(engine.counts.every((c) => c === 0)).toBe(true)
  })

  it('waits the delay chosen for each digit', () => {
    const clock = manualScheduler()
    const engine = new PlaybackEngine({
      source: createDigitSource('t', 'test', parseDigits('314')),
      arrange: (d) => ({
        note: null,
        durationLabel: 'rest',
        durationSec: 0,
        velocity: 0,
        delayMs: d * 10,
      }),
      scheduler: clock.scheduler,
    })
    engine.play()
    expect(clock.delays).toEqual([30])
    clock.flush()
    expect(clock.delays).toEqual([10])
  })

  it('uses setTimeout by default', () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    const engine = new PlaybackEngine({
      source: createDigitSource('t', 'test', parseDigits('31')),
      arrange: () => ({
        note: 'C4',
        durationLabel: '4n',
        durationSec: 0.5,
        velocity: 1,
        delayMs: 100,
      }),
      onStep,
    })
    engine.play()
    expect(onStep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(99)
    expect(onStep).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onStep).toHaveBeenCalledTimes(2)
    engine.dispose()
    vi.useRealTimers()
  })
})
