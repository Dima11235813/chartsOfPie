import { describe, expect, it } from 'vitest'
import { noteTableFor } from '../composition/arranger'
import { getPreset } from '../composition/presets'
import { alphabetOf } from '../digits/digitSource'
import { fibonacciDigitalRoots, fibonacciResidues, pisanoPeriod } from './fibonacci'
import { loadSource } from './load'
import { getSeries } from './series'
import { parseSourceLinkParam, sourceLinkParam } from './sourceConfig'

// Loops computed from A000045 (F₀ … F₂₃ = 0 … 28657), checked by hand for the first terms.
const MOD_5_LOOP = [0, 1, 1, 2, 3, 0, 3, 3, 1, 4, 0, 4, 4, 3, 2, 0, 2, 2, 4, 1]
const MOD_8_LOOP = [0, 1, 1, 2, 3, 5, 0, 5, 5, 2, 7, 1]
// Digital roots of F₀ … F₂₄: 13 → 4, 21 → 3, 34 → 7, 55 → 1, 89 → 8, 144 → 9, 233 → 8 …
const DIGITAL_ROOTS = [0, 1, 1, 2, 3, 5, 8, 4, 3, 7, 1, 8, 9, 8, 8, 7, 6, 4, 1, 5, 6, 2, 8, 1, 9]

const original = getPreset('original')!.config

describe('Fibonacci mod 5', () => {
  it('loops every 20 terms: 0 1 1 2 3 0 3 3 1 4 0 4 4 3 2 0 2 2 4 1', () => {
    expect(pisanoPeriod(5)).toBe(20)
    const { symbols } = fibonacciResidues(60, 5)
    for (let n = 0; n < 60; n++) expect(symbols[n]).toBe(MOD_5_LOOP[n % 20])
  })

  it('every fifth term is a multiple of 5 (F₅ = 5, F₁₀ = 55, F₁₅ = 610)', () => {
    MOD_5_LOOP.forEach((r, n) => expect(r === 0).toBe(n % 5 === 0))
  })

  it('on the C major pentatonic, five symbols are its five notes C D E G A', () => {
    expect(noteTableFor(original, 5)).toEqual(['C4', 'D4', 'E4', 'G4', 'A4'])
  })
})

describe('Fibonacci mod 8', () => {
  it('loops every 12 terms: 0 1 1 2 3 5 0 5 5 2 7 1, never 4 or 6', () => {
    expect(pisanoPeriod(8)).toBe(12)
    const { symbols } = fibonacciResidues(36, 8)
    for (let n = 0; n < 36; n++) expect(symbols[n]).toBe(MOD_8_LOOP[n % 12])
    expect(new Set(MOD_8_LOOP)).toEqual(new Set([0, 1, 2, 3, 5, 7]))
  })

  it('on the C major pentatonic it climbs into the next octave and never plays A4 or D5', () => {
    const notes = noteTableFor(original, 8)
    expect(notes).toEqual(['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'])
    const melody = MOD_8_LOOP.map((s) => notes[s])
    expect(melody).not.toContain('A4')
    expect(melody).not.toContain('D5')
  })
})

describe('Fibonacci digital roots', () => {
  it('sum the digits until one is left: 0 1 1 2 3 5 8 4 3 7 1 8 9 …', () => {
    const { symbols } = fibonacciDigitalRoots(25)
    expect(Array.from(symbols)).toEqual(DIGITAL_ROOTS)
  })

  it('agree with summing the actual digits, and loop every 24 terms from F₁', () => {
    const { symbols } = fibonacciDigitalRoots(200)
    const root = (n: bigint): number => {
      let s = n
      while (s > 9n) s = [...s.toString()].reduce((a, d) => a + BigInt(d), 0n)
      return Number(s)
    }
    let [a, b] = [0n, 1n]
    for (let n = 0; n < 200; n++) {
      expect(symbols[n]).toBe(root(a))
      if (n >= 25) expect(symbols[n]).toBe(symbols[n - 24])
      ;[a, b] = [b, a + b]
    }
    expect(pisanoPeriod(9)).toBe(24)
  })
})

describe('the new readings', () => {
  it('are offered for Fibonacci after base 12, and travel in links', () => {
    expect(getSeries('fibonacci').readings.slice(4)).toEqual(['digital-root', 'mod-5', 'mod-8'])
    for (const reading of ['digital-root', 'mod-5', 'mod-8'] as const) {
      const config = { version: 1, series: 'fibonacci', reading } as const
      expect(sourceLinkParam(config)).toBe(`fibonacci.${reading}`)
      expect(parseSourceLinkParam(`fibonacci.${reading}`)).toEqual({ status: 'ok', config })
      expect(parseSourceLinkParam(`pi.${reading}`).status).toBe('invalid')
    }
  })

  it('load sources with the right alphabet and loop', async () => {
    const load = (reading: 'digital-root' | 'mod-5' | 'mod-8') =>
      loadSource({ version: 1, series: 'fibonacci', reading })
    const [root, five, eight] = await Promise.all([
      load('digital-root'),
      load('mod-5'),
      load('mod-8'),
    ])
    expect([alphabetOf(root), root.period, root.id]).toEqual([10, 24, 'fibonacci:digital-root'])
    expect([alphabetOf(five), five.period]).toEqual([5, 20])
    expect([alphabetOf(eight), eight.period]).toEqual([8, 12])
    expect(Array.from({ length: 12 }, (_, i) => eight.digitAt(i))).toEqual(MOD_8_LOOP)
  })
})
