/**
 * Rhythms from the golden ratio (R-012 §3, S05.8.2). Pure functions of a step's position, so a
 * rhythm survives seeking, resuming and starting part-way into a number unchanged.
 */

const PHI = (1 + Math.sqrt(5)) / 2

/**
 * Letter n (from 0) of the infinite Fibonacci word 0100101001001010010100… (OEIS A003849), the
 * limit of 0 → 01, 1 → 0. Closed form: 1 − (⌊(n + 2)/φ⌋ − ⌊(n + 1)/φ⌋). Exact in floating point
 * far beyond a million steps (n/φ never lands within rounding error of an integer there).
 */
export function fibonacciWordLetter(n: number): 0 | 1 {
  return (1 - (Math.floor((n + 2) / PHI) - Math.floor((n + 1) / PHI))) as 0 | 1
}

/**
 * Fibonacci-word step lengths, in steps of the tempo grid: letter 0 is long and letter 1 short, in
 * the ratio φ : 1. Zeros are φ times as common as ones, so with these lengths the average step is
 * exactly one grid step and the tempo is kept: long = φ³/(φ² + 1) ≈ 1.171, short ≈ 0.724.
 */
export const FIBONACCI_WORD_LONG = PHI ** 3 / (PHI ** 2 + 1)
export const FIBONACCI_WORD_SHORT = PHI ** 2 / (PHI ** 2 + 1)

/** Fibonacci numbers 1, 2, 3, 5, 8, … (the distinct ones Zeckendorf sums use). */
const FIBONACCI: number[] = [1, 2]
while (FIBONACCI.at(-1)! < Number.MAX_SAFE_INTEGER / 2) {
  FIBONACCI.push(FIBONACCI.at(-1)! + FIBONACCI.at(-2)!)
}

/**
 * Zeckendorf representation of n ≥ 1: the unique sum of non-consecutive Fibonacci numbers, largest
 * first (12 = 8 + 3 + 1). Greedy is exact (Zeckendorf's theorem).
 */
export function zeckendorf(n: number): number[] {
  const terms: number[] = []
  let rest = Math.floor(n)
  for (let i = FIBONACCI.length - 1; i >= 0 && rest > 0; i--) {
    if (FIBONACCI[i]! <= rest) {
      terms.push(FIBONACCI[i]!)
      rest -= FIBONACCI[i]!
    }
  }
  return terms
}

/**
 * The Fibonacci "ruler": the smallest term of n's Zeckendorf representation. Like the binary ruler
 * 1 2 1 3 1 2 1 4 (the lowest set bit) that drummers count, but in Fibonacci numbers:
 * 1 2 3 1 5 1 2 8 1 2 3 1 13 … — self-similar, and each value F occurs in a share 1/φ^(k+1).
 */
export function zeckendorfRuler(n: number): number {
  return zeckendorf(n).at(-1) ?? 0
}

/** Longest Zeckendorf-ruler note, in grid steps (longer terms are held for this long). */
export const ZECKENDORF_MAX_STEPS = 5

/** Grid steps for the note at position `index` (from 0): its ruler value, at most 5. */
export function zeckendorfSteps(index: number): number {
  return Math.min(ZECKENDORF_MAX_STEPS, zeckendorfRuler(index + 1))
}
