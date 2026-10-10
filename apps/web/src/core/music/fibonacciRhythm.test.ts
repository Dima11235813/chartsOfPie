import { describe, expect, it } from 'vitest'
import {
  FIBONACCI_WORD_LONG,
  FIBONACCI_WORD_SHORT,
  fibonacciWordLetter,
  zeckendorf,
  zeckendorfRuler,
  zeckendorfSteps,
} from './fibonacciRhythm'

const PHI = (1 + Math.sqrt(5)) / 2

describe('Fibonacci word (OEIS A003849)', () => {
  it('starts 0100101001001010010100… and equals the 0 → 01, 1 → 0 substitution limit', () => {
    let word = '0'
    while (word.length < 20_000) word = word.replace(/./g, (c) => (c === '0' ? '01' : '0'))
    expect(Array.from({ length: 22 }, (_, n) => fibonacciWordLetter(n)).join('')).toBe(
      '0100101001001010010100',
    )
    for (let n = 0; n < 20_000; n++) expect(String(fibonacciWordLetter(n))).toBe(word[n])
  })

  it('has φ zeros for every one, and never two ones in a row', () => {
    let zeros = 0
    for (let n = 0; n < 100_000; n++) {
      const letter = fibonacciWordLetter(n)
      if (letter === 0) zeros++
      else expect(fibonacciWordLetter(n + 1)).toBe(0)
    }
    expect(zeros / (100_000 - zeros)).toBeCloseTo(PHI, 3)
  })

  it('long : short = φ, and the average step is exactly one grid step', () => {
    expect(FIBONACCI_WORD_LONG / FIBONACCI_WORD_SHORT).toBeCloseTo(PHI, 12)
    expect(FIBONACCI_WORD_LONG / PHI + FIBONACCI_WORD_SHORT / PHI ** 2).toBeCloseTo(1, 12)
  })
})

describe('Zeckendorf', () => {
  it('writes every number as non-consecutive Fibonacci numbers', () => {
    expect(zeckendorf(1)).toEqual([1])
    expect(zeckendorf(4)).toEqual([3, 1])
    expect(zeckendorf(12)).toEqual([8, 3, 1])
    expect(zeckendorf(100)).toEqual([89, 8, 3])
    const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]
    for (let n = 1; n <= 1000; n++) {
      const terms = zeckendorf(n)
      expect(terms.reduce((a, b) => a + b, 0)).toBe(n)
      const places = terms.map((t) => fib.indexOf(t))
      for (let i = 1; i < places.length; i++) expect(places[i - 1]! - places[i]!).toBeGreaterThan(1)
    }
  })

  it('the ruler (smallest term) is 1 2 3 1 5 1 2 8 1 2 3 1 13 …, each F in a share 1/φ^(k+1)', () => {
    expect(Array.from({ length: 13 }, (_, i) => zeckendorfRuler(i + 1)).join(' ')).toBe(
      '1 2 3 1 5 1 2 8 1 2 3 1 13',
    )
    const counts = new Map<number, number>()
    const N = 100_000
    for (let n = 1; n <= N; n++)
      counts.set(zeckendorfRuler(n), (counts.get(zeckendorfRuler(n)) ?? 0) + 1)
    expect(counts.get(1)! / N).toBeCloseTo(1 / PHI ** 2, 2) // 38.2 %
    expect(counts.get(2)! / N).toBeCloseTo(1 / PHI ** 3, 2) // 23.6 %
    expect(counts.get(3)! / N).toBeCloseTo(1 / PHI ** 4, 2) // 14.6 %
  })

  it('notes last the ruler value in steps, held at most 5', () => {
    expect(Array.from({ length: 13 }, (_, i) => zeckendorfSteps(i)).join(' ')).toBe(
      '1 2 3 1 5 1 2 5 1 2 3 1 5',
    )
  })
})
