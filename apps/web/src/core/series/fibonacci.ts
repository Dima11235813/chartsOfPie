import type { TermIndex } from '../digits/digitSource'

/**
 * Fibonacci numbers F₀ = 0, F₁ = 1, Fₙ = Fₙ₋₁ + Fₙ₋₂ (OEIS A000045) read as decimal symbols
 * (R-011 M3, R-012). Pure and deterministic; the loader wraps these into a `SymbolSource`.
 *
 * - `concat`: every digit of F₀, F₁, F₂… in order: 0 1 1 2 3 5 8 1 3 2 1 3 4… (F₀ = 0, decision
 *   D9). A million digits need only 3,094 terms (the last has ~650 digits), so BigInt is cheap.
 * - `last-digit`: Fₙ mod 10, one symbol per term. It repeats every 60 terms (the Pisano period
 *   π(10) = 60, A001175), so it is a table, no big numbers at all.
 * - `mod-12`: Fₙ mod 12, one pitch class per term (F05.5). It repeats every 24 terms (π(12) = 24)
 *   and never reaches 6, so played as semitones above C it is a 24-note melody without F♯.
 * - `base-12`: every digit of every term written in base 12 (R-013): F₁₂ = 144 is written 100, the
 *   last two digits repeat every 24 terms (π(144) = 24) and every 12th term ends in 00.
 */

export interface FibonacciSymbols {
  readonly symbols: Uint8Array
  readonly terms: TermIndex
}

/** Pisano period of 10: Fₙ mod 10 repeats every 60 terms. */
export const PISANO_10 = 60
/** Pisano period of 12: Fₙ mod 12 repeats every 24 terms. */
export const PISANO_12 = 24

/**
 * The Pisano period π(m): the length of the loop Fₙ mod m repeats (OEIS A001175). The pair
 * (Fₙ, Fₙ₊₁) mod m determines the rest, so the loop closes when (0, 1) comes back.
 */
export function pisanoPeriod(modulus: number): number {
  if (!Number.isInteger(modulus) || modulus < 1) throw new RangeError(`Bad modulus: ${modulus}`)
  if (modulus === 1) return 1
  let [a, b] = [0, 1]
  for (let n = 1; ; n++) {
    ;[a, b] = [b, (a + b) % modulus]
    if (a === 0 && b === 1) return n
  }
}

/** One term per symbol: term k starts at position k. */
const oneTermPerSymbol = (count: number): TermIndex => ({
  count,
  startOf: (term) => term,
  termAt: (position) => position,
})

/** Fₙ mod `modulus` (at most 256) for n = 0 … length − 1: one loop of π(m) terms, repeated. */
export function fibonacciResidues(length: number, modulus: number): FibonacciSymbols {
  if (modulus > 256) throw new RangeError(`Modulus ${modulus} does not fit a byte`)
  const size = pisanoPeriod(modulus)
  const period = new Uint8Array(size)
  let [a, b] = [0, 1 % modulus]
  for (let n = 0; n < size; n++) {
    period[n] = a
    ;[a, b] = [b, (a + b) % modulus]
  }
  const symbols = new Uint8Array(length)
  for (let n = 0; n < length; n++) symbols[n] = period[n % size]!
  return { symbols, terms: oneTermPerSymbol(length) }
}

/** Fₙ mod 10 for n = 0 … length − 1. */
export const fibonacciLastDigits = (length: number) => fibonacciResidues(length, 10)

/**
 * The first `length` digits of F₀ F₁ F₂ … written in `base` (2–36) one after another, with each
 * term's start.
 */
export function fibonacciConcatenated(length: number, base = 10): FibonacciSymbols {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new RangeError(`Bad base: ${base}`)
  const symbols = new Uint8Array(length)
  const starts: number[] = []
  let a = 0n
  let b = 1n
  let at = 0
  while (at < length) {
    starts.push(at)
    const text = a.toString(base)
    for (let i = 0; i < text.length && at < length; i++) symbols[at++] = parseInt(text[i]!, base)
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
 * First digits of the terms that start in [from, to): counts for 1 … base − 1 (index = digit).
 * Benford's law predicts a share log_b(1 + 1/d) for digit d, which Fibonacci numbers follow in
 * every base.
 */
export function firstDigitCounts(
  symbols: { digitAt(i: number): number },
  terms: TermIndex,
  from: number,
  to: number,
  base = 10,
): number[] {
  const counts = new Array<number>(base).fill(0)
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

/** Benford's law: the share of numbers written in `base` whose first digit is d. */
export const benfordShare = (d: number, base = 10) => Math.log(1 + 1 / d) / Math.log(base)
