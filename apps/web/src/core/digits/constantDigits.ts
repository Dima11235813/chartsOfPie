/*
 * Exact decimal digits of φ, √2 and e with integer (BigInt) arithmetic, each by two independent
 * methods so a bug in one cannot produce plausible-looking wrong digits (proj-mgmt R-011 §1, §8).
 * Used offline by scripts/generate-constants.ts to write public/data/*-1m.txt, and by tests to
 * re-derive the start of each file. Every function returns the first `count` digits, the integer
 * digit first (e.g. "16180…" for φ), truncated (not rounded).
 */

/** Extra digits carried past `count` so the truncated digits are exact (barring a 20-digit run of 9s). */
const GUARD = 20

const pow10 = (exponent: number) => 10n ** BigInt(exponent)

/** ⌊√n⌋ for n ≥ 0 (Newton's method from above, seeded by a recursive estimate). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('isqrt of a negative number')
  if (n < 2n) return n
  const bits = n.toString(2).length
  if (bits <= 52) {
    let root = BigInt(Math.floor(Math.sqrt(Number(n))))
    while (root * root > n) root -= 1n
    while ((root + 1n) * (root + 1n) <= n) root += 1n
    return root
  }
  // Start above the root: Newton from below would stop at once and return a wrong value.
  const shift = BigInt(Math.floor((bits - 1) / 4) + 1)
  let x = (isqrt(n >> (shift * 2n)) + 1n) << shift
  for (;;) {
    const y = (x + n / x) >> 1n
    if (y >= x) return x
    x = y
  }
}

/** First `count` digits of a value whose integer part is a single digit, from ⌊value · 10^scale⌋. */
function leadingDigits(scaled: bigint, count: number): string {
  const text = scaled.toString()
  if (text.length < count) throw new Error('not enough digits computed')
  return text.slice(0, count)
}

function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`Bad digit count: ${count}`)
}

/** Decimal digits needed so a ratio p/q with |error| < 1/q² is good to `count + GUARD` digits. */
const halfDigits = (count: number) => Math.ceil((count + GUARD) / 2) + 2

// ── φ = (1 + √5) / 2 ────────────────────────────────────────────────────────────────────────

/** φ by an integer square root: (10^s + ⌊√(5 · 10^2s)⌋) / 2. */
export function phiDigitsBySqrt(count: number): string {
  checkCount(count)
  const scale = count - 1 + GUARD
  const unit = pow10(scale)
  return leadingDigits((unit + isqrt(5n * unit * unit)) / 2n, count)
}

/** [F(n), F(n+1)] by fast doubling. */
export function fibonacciPair(n: number): [bigint, bigint] {
  if (n === 0) return [0n, 1n]
  const [a, b] = fibonacciPair(Math.floor(n / 2))
  const c = a * (2n * b - a)
  const d = a * a + b * b
  return n % 2 === 0 ? [c, d] : [d, c + d]
}

/** φ as the ratio of consecutive Fibonacci numbers F(n+1)/F(n), which differs by < 1/F(n)². */
export function phiDigitsByFibonacci(count: number): string {
  checkCount(count)
  // F(n) ≈ φⁿ/√5 must exceed 10^halfDigits.
  const n = Math.ceil((halfDigits(count) * Math.log(10)) / Math.log((1 + Math.sqrt(5)) / 2)) + 10
  const [fn, fn1] = fibonacciPair(n)
  return leadingDigits((fn1 * pow10(count - 1 + GUARD)) / fn, count)
}

// ── √2 ──────────────────────────────────────────────────────────────────────────────────────

/** √2 by an integer square root: ⌊√(2 · 10^2s)⌋. */
export function sqrt2DigitsBySqrt(count: number): string {
  checkCount(count)
  const unit = pow10(count - 1 + GUARD)
  return leadingDigits(isqrt(2n * unit * unit), count)
}

/**
 * √2 from the Pell numbers: (1 + √2)ⁿ = a + b√2 with a² − 2b² = ±1, so |a/b − √2| < 1/b².
 * Computed by binary powering in the ring ℤ[√2].
 */
export function sqrt2DigitsByPell(count: number): string {
  checkCount(count)
  const n = Math.ceil((halfDigits(count) * Math.log(10)) / Math.log(1 + Math.SQRT2)) + 10
  let a = 1n
  let b = 0n
  for (const bit of n.toString(2)) {
    ;[a, b] = [a * a + 2n * b * b, 2n * a * b]
    if (bit === '1') [a, b] = [a + 2n * b, a + b]
  }
  return leadingDigits((a * pow10(count - 1 + GUARD)) / b, count)
}

// ── e ───────────────────────────────────────────────────────────────────────────────────────

/** Smallest K with log10(K!) ≥ digits. */
function factorialTerms(digits: number): number {
  let k = 1
  let log = 0
  while (log < digits) {
    k += 1
    log += Math.log10(k)
  }
  return k
}

/**
 * e = Σ 1/k! by binary splitting: for [a, b), T/Q = Σ_{k=a+1..b} 1/((a+1)…k) with
 * Q = (a+1)…b, combined as T(a,b) = T(a,m)·Q(m,b) + T(m,b).
 */
export function eDigitsBySeries(count: number): string {
  checkCount(count)
  const split = (a: number, b: number): [bigint, bigint] => {
    if (b - a === 1) return [1n, BigInt(b)]
    const m = Math.floor((a + b) / 2)
    const [t1, q1] = split(a, m)
    const [t2, q2] = split(m, b)
    return [t1 * q2 + t2, q1 * q2]
  }
  const [t, q] = split(0, factorialTerms(count + GUARD + 2))
  return leadingDigits(pow10(count - 1 + GUARD) + (t * pow10(count - 1 + GUARD)) / q, count)
}

/** Term i of e's continued fraction [2; 1, 2, 1, 1, 4, 1, 1, 6, 1, …]. */
export const eContinuedFractionTerm = (i: number) =>
  i === 0 ? 2 : i % 3 === 2 ? (2 * (i + 1)) / 3 : 1

/**
 * e from a convergent p/q of its continued fraction (|e − p/q| < 1/q²). The convergent is the
 * product of the matrices [[aᵢ, 1], [1, 0]], multiplied by binary splitting.
 */
export function eDigitsByContinuedFraction(count: number): string {
  checkCount(count)
  // q grows at least as fast as the product of the terms; stop once that exceeds the target.
  const target = halfDigits(count) + 2
  let terms = 1
  for (let log = 0; log < target; terms++) log += Math.log10(eContinuedFractionTerm(terms))
  type Matrix = [bigint, bigint, bigint, bigint]
  const product = (lo: number, hi: number): Matrix => {
    if (hi - lo === 1) return [BigInt(eContinuedFractionTerm(lo)), 1n, 1n, 0n]
    const mid = Math.floor((lo + hi) / 2)
    const [a, b, c, d] = product(lo, mid)
    const [e, f, g, h] = product(mid, hi)
    return [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h]
  }
  const [p, , q] = product(0, terms + 3)
  return leadingDigits((p * pow10(count - 1 + GUARD)) / q, count)
}
