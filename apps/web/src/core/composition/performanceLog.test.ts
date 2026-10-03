import { describe, expect, it, vi } from 'vitest'
import { PerformanceLog, type PerformedStep } from './performanceLog'

const step = (
  index: number,
  note: string | null,
  durationSec: number,
  delayMs: number,
): PerformedStep => ({
  index,
  digit: index % 10,
  note,
  durationSec,
  velocity: 0.8,
  delayMs,
})

describe('PerformanceLog', () => {
  it('advances musical time by each scheduled gap', () => {
    const log = new PerformanceLog()
    log.record(step(0, 'C4', 1, 250))
    log.record(step(1, null, 0, 250)) // rest: time passes, nothing recorded
    log.record(step(2, 'E4', 1, 250))
    expect(log.notes.map((n) => [n.note, n.midi, n.startSec])).toEqual([
      ['C4', 60, 0],
      ['E4', 64, 0.5],
    ])
    expect(log.elapsedSec).toBeCloseTo(0.75)
    expect(log.lastOnsetSec).toBeCloseTo(0.5)
    expect(log.stepCount).toBe(3) // rests count as steps
    expect(log.lastStep?.index).toBe(2)
    log.reset()
    expect([log.stepCount, log.lastStep]).toEqual([0, null])
  })

  it('spots chords formed by coincidentally overlapping notes', () => {
    const log = new PerformanceLog()
    expect(log.record(step(0, 'A3', 2, 200))).toBeNull()
    expect(log.record(step(1, 'C4', 2, 200))).toBeNull() // only a dyad so far
    const chord = log.record(step(2, 'E4', 2, 200))
    expect(chord?.chord.symbol).toBe('Am')
    expect(chord?.atSec).toBeCloseTo(0.4)
    expect(chord?.notes.map((n) => n.note)).toEqual(['A3', 'C4', 'E4'])
    expect(log.chords).toHaveLength(1)
  })

  it('does not count notes that have already ended', () => {
    const log = new PerformanceLog()
    log.record(step(0, 'A3', 0.1, 200)) // ends at 0.1
    log.record(step(1, 'C4', 2, 200))
    expect(log.record(step(2, 'E4', 2, 200))).toBeNull()
    expect(log.soundingAt(0.4).map((n) => n.note)).toEqual(['C4', 'E4'])
  })

  it('queries windows, notifies subscribers, caps memory and resets', () => {
    const log = new PerformanceLog(3)
    const listener = vi.fn()
    const unsubscribe = log.subscribe(listener)
    for (let i = 0; i < 5; i++) log.record(step(i, 'C4', 0.1, 100))
    expect(listener).toHaveBeenCalledTimes(5)
    expect(log.notes.map((n) => n.index)).toEqual([2, 3, 4])
    expect(log.notesBetween(0.25, 0.35).map((n) => n.index)).toEqual([2, 3])
    unsubscribe()
    log.reset()
    expect(log.notes).toHaveLength(0)
    expect(log.elapsedSec).toBe(0)
    expect(listener).toHaveBeenCalledTimes(5)
  })
})
