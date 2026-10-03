import { describe, expect, it } from 'vitest'
import { midiToNote, noteToMidi } from './notes'
import { buildScaleNotes, MAJOR_PENTATONIC } from './scales'
import {
  LEGACY_DIGIT_DURATIONS,
  LEGACY_DIGIT_NOTES,
  legacyDurationForDigit,
  legacyNoteForDigit,
  legacyStepDelayMs,
} from './legacyMapping'

describe('notes', () => {
  it('converts between names and MIDI', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('Bb3')).toBe(58)
    expect(noteToMidi('C-1')).toBe(0)
    expect(midiToNote(61)).toBe('C#4')
    expect(midiToNote(0)).toBe('C-1')
    for (let midi = 0; midi < 128; midi++) expect(noteToMidi(midiToNote(midi))).toBe(midi)
  })

  it('rejects bad input', () => {
    expect(() => noteToMidi('H4')).toThrow()
    expect(() => midiToNote(1.5)).toThrow()
  })
})

describe('scales', () => {
  it('walks a scale across octaves', () => {
    expect(buildScaleNotes('F#', 3, MAJOR_PENTATONIC, 7)).toEqual([
      'F#3',
      'G#3',
      'A#3',
      'C#4',
      'D#4',
      'F#4',
      'G#4',
    ])
  })

  it('requires a root interval of 0', () => {
    expect(() => buildScaleNotes('C', 4, { id: 'x', name: 'x', intervals: [2, 4] }, 3)).toThrow()
  })
})

describe('legacy mapping (parity with legacy/simpleHtml/index.js)', () => {
  it('maps digits to the original C major pentatonic table', () => {
    // numberToNoteLookup and generateNumberToNoteLookup(4, 'C') in the legacy code
    expect(LEGACY_DIGIT_NOTES).toEqual(['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'])
    expect(legacyNoteForDigit(9)).toBe('A5')
  })

  it('maps digits to the original durations', () => {
    expect(LEGACY_DIGIT_DURATIONS).toEqual([
      '16n',
      '1n',
      '1t',
      '2n',
      '2t',
      '4n',
      '4t',
      '8n',
      '8t',
      '16t',
    ])
    expect(legacyDurationForDigit(0)).toBe('16n')
    expect(() => legacyDurationForDigit(10)).toThrow(RangeError)
    expect(() => legacyNoteForDigit(-1)).toThrow(RangeError)
  })

  it('waits a random multiple of 42 ms between 0 and 420 ms', () => {
    expect(legacyStepDelayMs(() => 0)).toBe(0)
    expect(legacyStepDelayMs(() => 0.7)).toBe(294)
    expect(legacyStepDelayMs(() => 0.96)).toBe(420)
    for (let i = 0; i < 200; i++) {
      const delay = legacyStepDelayMs()
      expect(delay % 42).toBe(0)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(420)
    }
  })
})
