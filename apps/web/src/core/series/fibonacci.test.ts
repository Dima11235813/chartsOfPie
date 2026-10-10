import { describe, expect, it } from 'vitest'
import { fibonacciConcatenated, fibonacciLastDigits, PISANO_10 } from './fibonacci'
import { loadSource } from './load'

// F₀…F₂₀ (OEIS A000045).
const FIRST = [
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
]

describe('Fibonacci, all digits (concat)', () => {
  it('writes F₀ F₁ F₂ … one after another: 0 1 1 2 3 5 8 1 3 2 1 3 4 5 5 8 9 1 4 4 …', () => {
    const { symbols } = fibonacciConcatenated(48)
    expect(Array.from(symbols).join('')).toBe(FIRST.join('')) // 48 digits
  })

  it('knows where every term starts, and which term a digit belongs to', () => {
    const { terms } = fibonacciConcatenated(1000)
    // 0 1 1 2 3 5 8 | 13 starts at 7, 21 at 9, 34 at 11, 89 at 15, 144 (F₁₂) at 17.
    expect([0, 1, 6, 7, 8, 9, 11, 12].map((t) => terms.startOf(t))).toEqual([
      0, 1, 6, 7, 9, 11, 15, 17,
    ])
    expect(terms.termAt(7)).toBe(7) // the 1 of 13
    expect(terms.termAt(8)).toBe(7) // the 3 of 13
    expect(terms.termAt(17)).toBe(12) // the 1 of 144
    expect(terms.termAt(19)).toBe(12) // its last 4
    expect(terms.termAt(21)).toBe(13) // inside 233
    for (let p = 0; p < 1000; p += 37) {
      const t = terms.termAt(p)
      expect(terms.startOf(t)).toBeLessThanOrEqual(p)
      expect(terms.startOf(t + 1)).toBeGreaterThan(p)
    }
  })

  it('a million digits take 3,094 terms, and every digit is ~10 % (yet first digits follow Benford)', () => {
    const { symbols, terms } = fibonacciConcatenated(1_000_000)
    expect(terms.count).toBe(3094)
    const counts = new Array<number>(10).fill(0)
    for (const d of symbols) counts[d]!++
    for (const c of counts) expect(c / 1e6).toBeCloseTo(0.1, 2)
    // First digit of F₁…F₃₀₀₀: a 1 about log₁₀ 2 ≈ 30.1 % of the time (Benford's law).
    let ones = 0
    for (let t = 1; t <= 3000; t++) if (symbols[terms.startOf(t)] === 1) ones++
    expect(ones / 3000).toBeCloseTo(Math.log10(2), 2)
  })
})

describe('Fibonacci, last digit', () => {
  it('is Fₙ mod 10, repeating every 60 terms (the Pisano period π(10), A001175)', () => {
    const { symbols, terms } = fibonacciLastDigits(200)
    expect(Array.from(symbols.slice(0, 21))).toEqual(FIRST.map((f) => f % 10))
    expect(PISANO_10).toBe(60)
    for (let n = 0; n < 140; n++) expect(symbols[n + 60]).toBe(symbols[n])
    // …and no shorter period.
    expect(
      [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30].some((p) =>
        symbols.slice(0, 60).every((d, i) => d === symbols[i + p]),
      ),
    ).toBe(false)
    expect(terms.termAt(123)).toBe(123)
  })

  it('odd digits come up twice as often as even ones: 8 against 4 per loop', () => {
    const counts = new Array<number>(10).fill(0)
    for (const d of fibonacciLastDigits(60).symbols) counts[d]!++
    expect(counts).toEqual([4, 8, 4, 8, 4, 8, 4, 8, 4, 8])
  })
})

describe('loading Fibonacci', () => {
  it('generates a million symbols with term starts, for either reading', async () => {
    const all = await loadSource({ version: 1, series: 'fibonacci', reading: 'concat' })
    expect(all.length).toBe(1_000_000)
    expect(all.id).toBe('fibonacci')
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => all.digitAt(i)).join('')).toBe('011235813')
    expect(all.terms?.termAt(8)).toBe(7)
    const last = await loadSource({ version: 1, series: 'fibonacci', reading: 'last-digit' })
    expect(last.id).toBe('fibonacci:last-digit')
    expect(last.digitAt(60 * 1000 + 7)).toBe(3) // F₇ = 13
  })
})

describe('positions as terms', () => {
  it('names terms with subscripts and says where a position sits', async () => {
    const { describePosition, termName } = await import('./fibonacci')
    expect(termName(100)).toBe('F₁₀₀')
    const all = fibonacciConcatenated(3000)
    expect(describePosition(all, 8)).toBe('in F₇') // the 3 of 13
    const last = { ...fibonacciLastDigits(500), period: PISANO_10 }
    expect(describePosition(last, 123)).toBe('F₁₂₃ · step 4 of 60')
    expect(describePosition({}, 5)).toBe('')
  })

  it('counts the first digit of each term that starts in a range (Benford)', async () => {
    const { benfordShare, firstDigitCounts } = await import('./fibonacci')
    const { symbols, terms } = fibonacciConcatenated(48)
    const source = { digitAt: (i: number) => symbols[i]! }
    // F₁…F₂₀: 1 1 2 3 5 8 13 21 34 55 89 144 233 377 610 987 1597 2584 4181 6765 (F₀ = 0 skipped).
    expect(firstDigitCounts(source, terms, 0, 48)).toEqual([0, 5, 4, 3, 1, 2, 2, 0, 2, 1])
    // A range that starts inside a term skips it: [8, 11) holds only 21 (13 began at 7, 34 at 11).
    expect(firstDigitCounts(source, terms, 8, 11)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0])
    expect(benfordShare(1)).toBeCloseTo(0.30103, 5)
    expect(
      Array.from({ length: 9 }, (_, i) => benfordShare(i + 1)).reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 12)
  })
})
