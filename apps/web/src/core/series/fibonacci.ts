import type { TermIndex } from '../digits/digitSource'

/**
 * Fibonacci numbers F₀ = 0, F₁ = 1, Fₙ = Fₙ₋₁ + Fₙ₋₂ (OEIS A000045) read as decimal symbols
 * (R-011 M3, R-012). Pure and deterministic; the loader wraps these into a `SymbolSource`.
 *
 * - `concat`: every digit of F₀, F₁, F₂… in order: 0 1 1 2 3 5 8 1 3 2 1 3 4… (F₀ = 0, decision
 *   D9). A million digits need only 3,094 terms (the last has ~650 digits), so BigInt is cheap.
 * - `last-digit`: Fₙ mod 10, one symbol per term. It repeats every 60 terms (the Pisano period
 *   π(10) = 60, A001175), so it is a table, no big numbers at all.
 */

export interface FibonacciSymbols {
  readonly symbols: Uint8Array
  readonly terms: TermIndex
}

/** Pisano period of 10: Fₙ mod 10 repeats every 60 terms. */
export const PISANO_10 = 60

/** One term per symbol: term k starts at position k. */
const oneTermPerSymbol = (count: number): TermIndex => ({
  count,
  startOf: (term) => term,
  termAt: (position) => position,
})

/** Fₙ mod 10 for n = 0 … length − 1. */
export function fibonacciLastDigits(length: number): FibonacciSymbols {
  const period = new Uint8Array(PISANO_10)
  let [a, b] = [0, 1]
  for (let n = 0; n < PISANO_10; n++) {
    period[n] = a
    ;[a, b] = [b, (a + b) % 10]
  }
  const symbols = new Uint8Array(length)
  for (let n = 0; n < length; n++) symbols[n] = period[n % PISANO_10]!
  return { symbols, terms: oneTermPerSymbol(length) }
}

/** The first `length` digits of F₀ F₁ F₂ … written one after another, with each term's start. */
export function fibonacciConcatenated(length: number): FibonacciSymbols {
  const symbols = new Uint8Array(length)
  const starts: number[] = []
  let a = 0n
  let b = 1n
  let at = 0
  while (at < length) {
    starts.push(at)
    const text = a.toString()
    for (let i = 0; i < text.length && at < length; i++) symbols[at++] = text.charCodeAt(i) - 48
    ;[a, b] = [b, a + b]
  }
  const table = Uint32Array.from(starts)
  return {
    symbols,
    terms: {
      count: table.length,
      startOf: (term) => table[term] ?? length,
      termAt: (position) => {
        // Last term whose start is ≤ position (binary search).
        let lo = 0
        let hi = table.length - 1
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1
          if (table[mid]! <= position) lo = mid
          else hi = mid - 1
        }
        return lo
      },
    },
  }
}
