import { describe, expect, it } from 'vitest'
import { Arranger, noteTableFor } from '../composition/arranger'
import type { CompositionConfig } from '../composition/config'
import { getPreset } from '../composition/presets'
import { alphabetOf, symbolGlyph, toDecimalSymbol, windowFrom } from '../digits/digitSource'
import { LEGACY_DIGIT_DURATIONS } from '../music/legacyMapping'
import { digitNoteTable, digitToMidi } from '../music/mapping'
import { noteToMidi } from '../music/notes'
import { getScale } from '../music/scaleCatalogue'
import { fibonacciResidues, PISANO_10, PISANO_12, pisanoPeriod } from './fibonacci'
import { loadSource } from './load'
import { getSeries } from './series'
import { parseSourceLinkParam, sourceKey, sourceLinkParam, sourceName } from './sourceConfig'

/** Fₙ mod 12 for n = 0 … 23 (one Pisano loop; computed from A000045). */
const MOD_12_LOOP = [0, 1, 1, 2, 3, 5, 8, 1, 9, 10, 7, 5, 0, 5, 5, 10, 3, 1, 4, 5, 9, 2, 11, 1]

const original = getPreset('original')!.config

describe('Pisano periods (OEIS A001175)', () => {
  it('π(1) … π(12) = 1, 3, 8, 6, 20, 24, 16, 12, 24, 60, 10, 24', () => {
    expect(Array.from({ length: 12 }, (_, i) => pisanoPeriod(i + 1))).toEqual([
      1, 3, 8, 6, 20, 24, 16, 12, 24, 60, 10, 24,
    ])
    expect([PISANO_10, PISANO_12]).toEqual([60, 24])
  })

  it('rejects a modulus that is not a positive whole number', () => {
    expect(() => pisanoPeriod(0)).toThrow(RangeError)
    expect(() => pisanoPeriod(2.5)).toThrow(RangeError)
  })
})

describe('Fibonacci mod 12', () => {
  it('is the 24-step loop 0 1 1 2 3 5 8 1 9 10 7 5 0 5 5 10 3 1 4 5 9 2 11 1, repeated', () => {
    const { symbols } = fibonacciResidues(72, 12)
    expect(Array.from(symbols.subarray(0, 24))).toEqual(MOD_12_LOOP)
    expect(Array.from(symbols.subarray(24, 48))).toEqual(MOD_12_LOOP)
    expect(Array.from(symbols.subarray(48))).toEqual(MOD_12_LOOP)
  })

  it('uses 11 of the 12 residues and never 6', () => {
    const used = new Set(MOD_12_LOOP)
    expect(used.size).toBe(11)
    expect(used.has(6)).toBe(false)
  })

  it('as semitones above C4: a 24-note melody that never plays F♯ (the tritone above C)', () => {
    const semitones: CompositionConfig = { ...original, mapping: 'semitones' }
    const notes = noteTableFor(semitones, 12)
    expect(notes).toEqual([
      'C4',
      'C#4',
      'D4',
      'D#4',
      'E4',
      'F4',
      'F#4',
      'G4',
      'G#4',
      'A4',
      'A#4',
      'B4',
    ])
    const melody = MOD_12_LOOP.map((s) => notes[s])
    expect(melody.slice(0, 12)).toEqual([
      'C4',
      'C#4',
      'C#4',
      'D4',
      'D#4',
      'F4',
      'G#4',
      'C#4',
      'A4',
      'A#4',
      'G4',
      'F4',
    ])
    expect(melody).not.toContain('F#4')
  })

  it('the last-digit reading is the same generator with modulus 10', () => {
    const { symbols } = fibonacciResidues(60, 10)
    expect(Array.from(symbols.subarray(0, 12))).toEqual([0, 1, 1, 2, 3, 5, 8, 3, 1, 4, 5, 9])
  })
})

describe('the mod-12 reading', () => {
  it('is offered for Fibonacci after all digits and last digit', () => {
    expect(getSeries('fibonacci').readings.slice(0, 3)).toEqual(['concat', 'last-digit', 'mod-12'])
  })

  it('round-trips through links as s=fibonacci.mod-12', () => {
    const read = parseSourceLinkParam('fibonacci.mod-12')
    expect(read).toEqual({
      status: 'ok',
      config: { version: 1, series: 'fibonacci', reading: 'mod-12' },
    })
    if (read.status !== 'ok') return
    expect(sourceLinkParam(read.config)).toBe('fibonacci.mod-12')
    expect(sourceKey(read.config)).toBe('fibonacci:mod-12')
    expect(sourceName(read.config)).toBe('Fibonacci numbers · mod 12')
  })

  it('cannot be applied to a constant', () => {
    expect(parseSourceLinkParam('pi.mod-12').status).toBe('invalid')
  })

  it('loads a 12-symbol source with one term per symbol and a 24-step period', async () => {
    const source = await loadSource({ version: 1, series: 'fibonacci', reading: 'mod-12' })
    expect(source.id).toBe('fibonacci:mod-12')
    expect(alphabetOf(source)).toBe(12)
    expect(source.period).toBe(24)
    expect(source.terms?.termAt(123)).toBe(123)
    expect(Array.from({ length: 24 }, (_, i) => source.digitAt(i))).toEqual(MOD_12_LOOP)
    // A starting point keeps the alphabet.
    expect(alphabetOf(windowFrom(source, 100))).toBe(12)
  })

  it('last digit stays a ten-symbol source', async () => {
    const source = await loadSource({ version: 1, series: 'fibonacci', reading: 'last-digit' })
    expect(source.id).toBe('fibonacci:last-digit')
    expect(alphabetOf(source)).toBe(10)
    expect(source.period).toBe(60)
  })
})

describe('symbols beyond 9', () => {
  it('are written as one character each: 0–9, then A, B …', () => {
    expect([0, 9, 10, 11, 15, 35].map(symbolGlyph)).toEqual(['0', '9', 'A', 'B', 'F', 'Z'])
    expect(symbolGlyph(36)).toBe('?')
  })

  it('scale onto 0–9 for the ten original note lengths (R-011 D7)', () => {
    expect(Array.from({ length: 12 }, (_, s) => toDecimalSymbol(s, 12))).toEqual([
      0, 0, 1, 2, 3, 4, 5, 5, 6, 7, 8, 9,
    ])
    expect(Array.from({ length: 10 }, (_, s) => toDecimalSymbol(s, 10))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ])
    expect([toDecimalSymbol(0, 2), toDecimalSymbol(1, 2)]).toEqual([0, 5])
  })
})

describe('mapping k symbols onto a scale', () => {
  const pentatonic = getScale('major-pentatonic')
  const c4 = noteToMidi('C4')

  it('ten digits are unchanged', () => {
    expect(digitNoteTable(pentatonic, 'C', 4, 'ascending')).toEqual(
      digitNoteTable(pentatonic, 'C', 4, 'ascending', 10),
    )
    expect(digitToMidi(5, 'centred', pentatonic, c4)).toBe(c4)
  })

  it('ascending climbs on past the tenth note: symbol 11 of C pentatonic is D6', () => {
    expect(digitNoteTable(pentatonic, 'C', 4, 'ascending', 12).slice(10)).toEqual(['C6', 'D6'])
  })

  it('centred puts the root on ⌊k/2⌋: symbol 6 of 12', () => {
    expect(digitToMidi(6, 'centred', pentatonic, c4, 12)).toBe(c4)
    expect(digitToMidi(5, 'centred', pentatonic, c4, 12)).toBe(noteToMidi('A3'))
  })

  it('rejects a symbol outside the alphabet', () => {
    expect(() => digitToMidi(10, 'ascending', pentatonic, c4)).toThrow('Not a decimal digit')
    expect(() => digitToMidi(12, 'ascending', pentatonic, c4, 12)).toThrow('outside 0..11')
  })
})

describe('Arranger with a 12-symbol alphabet', () => {
  it('plays symbols 10 and 11, and the original note lengths scale onto the ten lengths', () => {
    const arranger = new Arranger(original)
    arranger.setAlphabet(12)
    expect(arranger.noteTable).toHaveLength(12)
    const eleven = arranger.arrange(11)
    expect(eleven.note).toBe('D6')
    expect(eleven.durationLabel).toBe(LEGACY_DIGIT_DURATIONS[9])
    expect(arranger.arrange(1).durationLabel).toBe(LEGACY_DIGIT_DURATIONS[0])
  })

  it('digit-length rhythm: symbol s holds ⌊s·10/12⌋ steps (at least one)', () => {
    const config: CompositionConfig = {
      ...original,
      timing: 'tempo',
      rhythm: 'digit-length',
      bpm: 120,
      subdivision: 2,
      swing: 0,
    }
    const arranger = new Arranger(config)
    arranger.setAlphabet(12)
    expect(arranger.arrange(11).delayMs).toBe(9 * 250)
    expect(arranger.arrange(1).delayMs).toBe(250)
    expect(arranger.arrange(0).note).toBeNull() // 0 is a rest, as for digits
  })

  it('a config change keeps the alphabet', () => {
    const arranger = new Arranger(original)
    arranger.setAlphabet(12)
    arranger.setConfig({ ...original, mapping: 'semitones' })
    expect(arranger.noteTable[6]).toBe('F#4')
    arranger.setAlphabet(10)
    expect(arranger.noteTable).toHaveLength(10)
  })
})
