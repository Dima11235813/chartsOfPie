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

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'

/** Fₙ with a subscript index: F₁₀₀. */
export const termName = (n: number) => `F${String(n).replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]!)}`

/**
 * Where a position sits among the terms, for labels: "in F₁₀₀" for concatenated digits, or
 * "F₁₂₃ · step 4 of 60" for a periodic one-symbol-per-term reading. Empty without a term index.
 */
export function describePosition(
  source: { terms?: TermIndex; period?: number },
  position: number,
): string {
  if (!source.terms) return ''
  const term = source.terms.termAt(position)
  if (source.period)
    return `${termName(term)} · step ${(term % source.period) + 1} of ${source.period}`
  return `in ${termName(term)}`
}

/**
 * First digits of the terms that start in [from, to): counts for 1–9 (index = digit). Benford's
 * law predicts a share log₁₀(1 + 1/d) for digit d, which Fibonacci numbers follow.
 */
export function firstDigitCounts(
  symbols: { digitAt(i: number): number },
  terms: TermIndex,
  from: number,
  to: number,
): number[] {
  const counts = new Array<number>(10).fill(0)
  if (to <= from) return counts
  for (let t = terms.termAt(from); t < terms.count; t++) {
    const start = terms.startOf(t)
    if (start >= to) break
    if (start < from) continue
    const digit = symbols.digitAt(start)
    // F₀ = 0 is the only term starting with 0; Benford counts from F₁.
    if (digit > 0) counts[digit]!++
  }
  return counts
}

/** Benford's law: the share of numbers whose first digit is d. */
export const benfordShare = (d: number) => Math.log10(1 + 1 / d)
