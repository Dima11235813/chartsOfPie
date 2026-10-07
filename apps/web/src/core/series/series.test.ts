import { describe, expect, test } from 'vitest'
import { createDigitSource, windowFrom } from '../digits/digitSource'
import { DigitCounter } from '../digits/digitCounter'
import { PlaybackEngine } from '../engine/playbackEngine'
import {
  getReading,
  getSeries,
  READING_IDS,
  READINGS,
  SERIES,
  SERIES_IDS,
  withSymbol,
} from './series'
import {
  DEFAULT_SOURCE_CONFIG,
  parseSourceLinkParam,
  readSourceConfig,
  sourceLinkParam,
  sourceKey,
  sourceName,
  sourceSymbol,
} from './sourceConfig'

describe('series registry', () => {
  test('ids are persisted forever: the registry offers exactly the persisted ids', () => {
    // Adding an id is fine; renaming or removing one breaks links and saved pieces (R-011 §6).
    expect(SERIES.map((s) => s.id)).toEqual([...SERIES_IDS])
    expect(READINGS.map((r) => r.id)).toEqual([...READING_IDS])
    for (const id of ['pi', 'phi', 'e', 'sqrt2'] as const) expect(SERIES_IDS).toContain(id)
    for (const id of ['digits'] as const) expect(READING_IDS).toContain(id)
  })

  test('every series offers readings that exist', () => {
    for (const series of SERIES) {
      expect(series.readings.length).toBeGreaterThan(0)
      for (const reading of series.readings) expect(getReading(reading).id).toBe(reading)
    }
  })

  test('π is the decimal digits 3, 1, 4, 1, 5 … (OEIS A000796)', () => {
    const pi = getSeries('pi')
    expect(pi).toMatchObject({ symbol: 'π', kind: 'constant', oeis: 'A000796' })
    expect(pi.readings[0]).toBe('digits')
    expect(getReading('digits').alphabetSize).toBe(10)
  })
})

describe('SourceConfig', () => {
  test('the default is π read as digits, and links leave it out', () => {
    expect(DEFAULT_SOURCE_CONFIG).toEqual({ version: 1, series: 'pi', reading: 'digits' })
    expect(sourceLinkParam(DEFAULT_SOURCE_CONFIG)).toBe('')
    expect(sourceName(DEFAULT_SOURCE_CONFIG)).toBe('π (pi)')
    expect(sourceSymbol(DEFAULT_SOURCE_CONFIG)).toBe('π')
  })

  test('reads current configs', () => {
    expect(readSourceConfig({ version: 1, series: 'pi', reading: 'digits' })).toEqual({
      status: 'ok',
      config: DEFAULT_SOURCE_CONFIG,
    })
  })

  test('a newer version, series or reading is too-new — never π', () => {
    expect(readSourceConfig({ version: 2, series: 'pi', reading: 'digits' }).status).toBe('too-new')
    expect(readSourceConfig({ version: 1, series: 'primes', reading: 'digits' }).status).toBe(
      'too-new',
    )
    expect(readSourceConfig({ version: 1, series: 'pi', reading: 'mod' }).status).toBe('too-new')
    expect(parseSourceLinkParam('fibonacci.last-digit').status).toBe('too-new')
  })

  test('garbage is invalid', () => {
    for (const input of [null, 'pi', {}, { version: 1 }, { version: 1, series: 3, reading: 'x' }])
      expect(readSourceConfig(input).status).toBe('invalid')
    for (const value of ['', 'Pi', 'pi.', '.digits', 'pi digits', 'pi.digits.more'])
      expect(parseSourceLinkParam(value).status).toBe('invalid')
  })

  test('the constants: φ, e and √2 read as digits, linked by id', () => {
    const phi = { version: 1, series: 'phi', reading: 'digits' } as const
    expect(sourceLinkParam(phi)).toBe('phi')
    expect(parseSourceLinkParam('phi')).toEqual({ status: 'ok', config: phi })
    expect(sourceKey(phi)).toBe('phi')
    expect(sourceName(phi)).toBe('φ (golden ratio)')
    expect(SERIES.map((s) => s.symbol)).toEqual(['π', 'φ', 'e', '√2'])
    expect(SERIES.map((s) => s.oeis)).toEqual(['A000796', 'A001622', 'A001113', 'A002193'])
    expect(withSymbol('π walk', 'φ')).toBe('φ walk')
    expect(withSymbol('Typographic π', '√2')).toBe('Typographic √2')
  })

  test('link values round-trip', () => {
    expect(parseSourceLinkParam('pi')).toEqual({ status: 'ok', config: DEFAULT_SOURCE_CONFIG })
    expect(parseSourceLinkParam('pi.digits')).toEqual({
      status: 'ok',
      config: DEFAULT_SOURCE_CONFIG,
    })
  })
})

describe('sources with other alphabets', () => {
  const symbols = (values: number[], alphabetSize: number) => ({
    ...createDigitSource('test', 'test', Uint8Array.from(values)),
    alphabetSize,
  })

  test('the counter counts any alphabet and rejects symbols outside it', () => {
    const counter = new DigitCounter(12)
    for (const s of [0, 11, 11, 5]) counter.record(s)
    expect(counter.counts).toHaveLength(12)
    expect(counter.counts[11]).toBe(2)
    expect(() => counter.record(12)).toThrow(/outside 0..11/)
    expect(() => new DigitCounter().record(10)).toThrow(/Not a decimal digit: 10/)
    expect(() => new DigitCounter(0)).toThrow(RangeError)
  })

  test('the engine counts with the source alphabet, also after switching sources', () => {
    const arrange = () => ({
      note: null,
      durationLabel: 'rest',
      durationSec: 0,
      velocity: 0,
      delayMs: 0,
    })
    const engine = new PlaybackEngine({ source: symbols([1, 0, 1, 1], 2), arrange })
    expect(engine.counts).toEqual([0, 0])
    for (let i = 0; i < 4; i++) engine.step()
    expect(engine.counts).toEqual([1, 3])
    engine.setSource(symbols([11, 3], 12))
    engine.step()
    expect(engine.counts).toHaveLength(12)
    expect(engine.counts[11]).toBe(1)
    engine.setSource(createDigitSource('d', 'decimal', Uint8Array.from([9])))
    expect(engine.step()?.counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
  })

  test('a window keeps the alphabet of its source', () => {
    expect(windowFrom(symbols([0, 1, 1], 2), 1).alphabetSize).toBe(2)
    expect(windowFrom(createDigitSource('d', 'd', Uint8Array.from([1, 2])), 1).alphabetSize).toBe(
      undefined,
    )
  })
})
