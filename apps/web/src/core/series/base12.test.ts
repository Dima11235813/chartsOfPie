import { describe, expect, it } from 'vitest'
import { alphabetOf, symbolGlyph, windowFrom } from '../digits/digitSource'
import {
  benfordShare,
  fibonacciConcatenated,
  firstDigitCounts,
  pisanoPeriod,
  PISANO_12,
} from './fibonacci'
import { loadSource } from './load'
import { getReading, getSeries } from './series'
import { parseSourceLinkParam, sourceKey, sourceLinkParam, sourceName } from './sourceConfig'

// F₀…F₂₅ (OEIS A000045) written in base 12, A = 10 and B = 11 (each checked by hand from the
// decimal value: F₁₂ = 144 = 1·12² → 100, F₁₇ = 1597 = 11·144 + 1·12 + 1 → B11).
const IN_BASE_12 = [
  '0',
  '1',
  '1',
  '2',
  '3',
  '5',
  '8',
  '11',
  '19',
  '2A',
  '47',
  '75',
  '100',
  '175',
  '275',
  '42A',
  '6A3',
  'B11',
  '15B4',
  '2505',
  '3AB9',
  '6402',
  'A2BB',
  '14701',
  '22A00',
  '37501',
]

const glyphs = (symbols: Uint8Array) => Array.from(symbols, symbolGlyph).join('')

describe('Fibonacci in base 12', () => {
  it('writes F₀ F₁ F₂ … in base 12, one after another: 0 1 1 2 3 5 8 11 19 2A 47 75 100 …', () => {
    const text = IN_BASE_12.join('')
    expect(glyphs(fibonacciConcatenated(text.length, 12).symbols)).toBe(text)
  })

  it('base 10 is unchanged by the base parameter', () => {
    expect(fibonacciConcatenated(500, 10).symbols).toEqual(fibonacciConcatenated(500).symbols)
  })

  it('F₁₂ = 144 = 12² is written 100, and its term index points there', () => {
    const { symbols, terms } = fibonacciConcatenated(200, 12)
    const at = terms.startOf(12)
    expect(glyphs(symbols.subarray(at, at + 3))).toBe('100')
    expect(terms.termAt(at + 2)).toBe(12)
  })

  it('the last base-12 digit is Fₙ mod 12 (24-step loop); the last two repeat every 24 too', () => {
    expect(PISANO_12).toBe(24)
    // π(144) = 24 = π(12): two dozenal digits loop as fast as one. Base 10 needs 60, then 300.
    expect(pisanoPeriod(144)).toBe(24)
    expect([pisanoPeriod(10), pisanoPeriod(100), pisanoPeriod(1728)]).toEqual([60, 300, 288])
  })

  it('every 12th term ends in 00, and only those (Fₙ divisible by 144 ⇔ 12 divides n)', () => {
    let [a, b] = [0n, 1n]
    for (let n = 0; n < 300; n++) {
      if (n > 0) expect(a.toString(12).endsWith('00')).toBe(n % 12 === 0)
      ;[a, b] = [b, a + b]
    }
  })

  it('first digits follow Benford’s law in base 12: a 1 about 27.9 % of the time, B about 3.5 %', () => {
    const { symbols, terms } = fibonacciConcatenated(1_000_000, 12)
    expect(terms.count).toBe(3214)
    const source = { digitAt: (i: number) => symbols[i]! }
    const counts = firstDigitCounts(source, terms, 0, terms.startOf(3001), 12)
    expect(counts).toHaveLength(12)
    expect(counts[0]).toBe(0)
    const sum = counts.reduce((x, y) => x + y, 0)
    expect(sum).toBe(3000)
    for (let d = 1; d < 12; d++) expect(counts[d]! / sum).toBeCloseTo(benfordShare(d, 12), 2)
    expect(benfordShare(1, 12)).toBeCloseTo(0.27894, 5)
    expect(benfordShare(11, 12)).toBeCloseTo(0.03502, 5)
    expect(
      Array.from({ length: 11 }, (_, i) => benfordShare(i + 1, 12)).reduce((x, y) => x + y, 0),
    ).toBeCloseTo(1, 10)
    // …while all twelve symbols together come out about even (1/12 ≈ 8.3 % each).
    const all = new Array<number>(12).fill(0)
    for (const s of symbols) all[s]!++
    for (const c of all) expect(c / 1e6).toBeCloseTo(1 / 12, 2)
  })

  it('rejects a base outside 2–36', () => {
    expect(() => fibonacciConcatenated(10, 1)).toThrow(RangeError)
    expect(() => fibonacciConcatenated(10, 37)).toThrow(RangeError)
  })
})

describe('the base-12 reading', () => {
  it('is offered for Fibonacci after mod 12, with twelve symbols', () => {
    expect(getSeries('fibonacci').readings).toEqual(['concat', 'last-digit', 'mod-12', 'base-12'])
    expect(getReading('base-12').alphabetSize).toBe(12)
  })

  it('round-trips through links as s=fibonacci.base-12, and not for constants', () => {
    const read = parseSourceLinkParam('fibonacci.base-12')
    expect(read).toEqual({
      status: 'ok',
      config: { version: 1, series: 'fibonacci', reading: 'base-12' },
    })
    if (read.status !== 'ok') return
    expect(sourceLinkParam(read.config)).toBe('fibonacci.base-12')
    expect(sourceKey(read.config)).toBe('fibonacci:base-12')
    expect(sourceName(read.config)).toBe('Fibonacci numbers · all digits in base 12')
    expect(parseSourceLinkParam('pi.base-12').status).toBe('invalid')
  })

  it('loads a million 12-symbol digits with term starts and no loop', async () => {
    const source = await loadSource({ version: 1, series: 'fibonacci', reading: 'base-12' })
    expect(source.id).toBe('fibonacci:base-12')
    expect(source.length).toBe(1_000_000)
    expect(alphabetOf(source)).toBe(12)
    expect(source.period).toBeUndefined()
    expect(source.terms?.count).toBe(3214)
    expect(alphabetOf(windowFrom(source, 100))).toBe(12)
  })
})
