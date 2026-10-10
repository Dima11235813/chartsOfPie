import { describe, expect, test } from 'vitest'
import {
  fibonacciConcatDigits,
  fibonacciLastDigits,
  fibonacciMod,
  firstPrimes,
  pisanoPeriod,
  primeConcatDigits,
  primeLastDigits,
  primesBelow,
} from './integerSequences'

const text = (digits: Uint8Array) => Array.from(digits).join('')

describe('Fibonacci (OEIS A000045)', () => {
  test('starts F₀ = 0, F₁ = 1 (decision D9) and each term is the sum of the two before', () => {
    // A000045: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987
    expect(fibonacciMod(17, 1_000)).toEqual([
      0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987,
    ])
  })

  test('Pisano periods: mod 2 → 3, mod 3 → 8, mod 5 → 20, mod 10 → 60, mod 12 → 24 (A001175)', () => {
    expect([2, 3, 5, 8, 10, 12].map(pisanoPeriod)).toEqual([3, 8, 20, 12, 60, 24])
  })

  test('written out: 0 1 1 2 3 5 8 13 21 34 55 89 144 …', () => {
    expect(text(fibonacciConcatDigits(25))).toBe('0112358132134558914423337')
    expect(fibonacciConcatDigits(0)).toHaveLength(0)
  })

  test('written out, a million digits, every digit is near 10 %', () => {
    const digits = fibonacciConcatDigits(1_000_000)
    expect(digits).toHaveLength(1_000_000)
    const counts = new Array<number>(10).fill(0)
    for (const d of digits) counts[d]! += 1
    for (const count of counts) expect(count / 1_000_000).toBeGreaterThan(0.099)
    for (const count of counts) expect(count / 1_000_000).toBeLessThan(0.101)
  })

  test('last digits: a loop of 60 with odd digits twice as common as even ones (R-012 §1)', () => {
    const digits = fibonacciLastDigits(120)
    expect(text(digits.subarray(0, 20))).toBe('01123583145943707741')
    expect(text(digits.subarray(60, 80))).toBe(text(digits.subarray(0, 20)))
    const counts = new Array<number>(10).fill(0)
    for (const d of digits.subarray(0, 60)) counts[d]! += 1
    expect(counts).toEqual([4, 8, 4, 8, 4, 8, 4, 8, 4, 8])
  })
})

describe('primes (OEIS A000040)', () => {
  test('the first primes', () => {
    expect(Array.from(firstPrimes(15))).toEqual([
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
    ])
    expect(Array.from(primesBelow(2))).toEqual([])
    expect(Array.from(primesBelow(3))).toEqual([2])
  })

  test('prime counts π(10ⁿ): 4, 25, 168, 1229, 9592, 78498, 664579 (A006880)', () => {
    expect([10, 100, 1e3, 1e4, 1e5, 1e6, 1e7].map((n) => primesBelow(n).length)).toEqual([
      4, 25, 168, 1229, 9592, 78498, 664579,
    ])
  })

  test('the millionth prime is 15,485,863', () => {
    const primes = firstPrimes(1_000_000)
    expect(primes).toHaveLength(1_000_000)
    expect(primes[999_999]).toBe(15_485_863)
  })

  test('written out: the Copeland–Erdős constant 0.235711131719232931374143… (A033308)', () => {
    expect(text(primeConcatDigits(30))).toBe('235711131719232931374143475359')
    expect(primeConcatDigits(1_000_000)).toHaveLength(1_000_000)
  })

  test('last digits: after 2, 3 and 5, only 1, 3, 7 and 9', () => {
    const digits = primeLastDigits(10_000)
    expect(text(digits.subarray(0, 12))).toBe('235713793917')
    const seen = new Set(digits.subarray(3))
    expect([...seen].sort()).toEqual([1, 3, 7, 9])
  })
})
