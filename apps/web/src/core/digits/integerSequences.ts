/*
 * Whole-number sequences read as decimal digits (proj-mgmt R-011 M3, F05.2, F05.4). Pure and
 * deterministic: every function returns exactly `count` digits (0–9) in a Uint8Array.
 *
 * Two readings per sequence:
 * - `concat`: the terms written out one after another ("0112358132134…" for Fibonacci from F₀,
 *   decision D9; "2357111317…" for the primes, the Copeland–Erdős constant, OEIS A033308).
 * - `last-digit`: the last digit of each term (Fibonacci: a loop of 60, the Pisano period;
 *   primes: only 1, 3, 7 and 9 after 2, 3, 5).
 */

function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`Bad digit count: ${count}`)
}

/** Write each term's decimal digits into `out` until it is full. */
function writeTerms(count: number, nextTerm: () => string): Uint8Array {
  const out = new Uint8Array(count)
  let filled = 0
  while (filled < count) {
    const text = nextTerm()
    for (let i = 0; i < text.length && filled < count; i++) out[filled++] = text.charCodeAt(i) - 48
  }
  return out
}

// ── Fibonacci (OEIS A000045) ────────────────────────────────────────────────────────────────

/** Fₙ mod m for n = 0 … count − 1, without BigInt. */
export function fibonacciMod(count: number, modulus: number): number[] {
  checkCount(count)
  const terms: number[] = []
  let a = 0
  let b = 1 % modulus
  for (let i = 0; i < count; i++) {
    terms.push(a)
    ;[a, b] = [b, (a + b) % modulus]
  }
  return terms
}

/** Length of the cycle of Fₙ mod m (the Pisano period π(m)), for m ≥ 2. */
export function pisanoPeriod(modulus: number): number {
  let a = 0
  let b = 1
  for (let i = 1; ; i++) {
    ;[a, b] = [b, (a + b) % modulus]
    if (a === 0 && b === 1) return i
  }
}

/** F₀, F₁, F₂, … written out: 0 1 1 2 3 5 8 1 3 2 1 3 4 … */
export function fibonacciConcatDigits(count: number): Uint8Array {
  checkCount(count)
  let a = 0n
  let b = 1n
  return writeTerms(count, () => {
    const text = a.toString()
    ;[a, b] = [b, a + b]
    return text
  })
}

/** The last digit of F₀, F₁, F₂, …: a loop of 60 (0 1 1 2 3 5 8 3 1 4 5 9 …). */
export function fibonacciLastDigits(count: number): Uint8Array {
  checkCount(count)
  const loop = fibonacciMod(pisanoPeriod(10), 10)
  return Uint8Array.from({ length: count }, (_, i) => loop[i % loop.length]!)
}

// ── Primes (OEIS A000040) ───────────────────────────────────────────────────────────────────

/** Every prime below `limit` (sieve of Eratosthenes over odd numbers). */
export function primesBelow(limit: number): Uint32Array {
  if (limit <= 2) return new Uint32Array(0)
  // composite[i] is for the odd number 2i + 1.
  const size = Math.floor((limit - 1) / 2) + 1
  const composite = new Uint8Array(size)
  for (let i = 1; (2 * i + 1) * (2 * i + 1) < limit; i++) {
    if (composite[i]) continue
    const p = 2 * i + 1
    for (let j = (p * p - 1) / 2; j < size; j += p) composite[j] = 1
  }
  const primes: number[] = [2]
  for (let i = 1; i < size; i++) if (!composite[i] && 2 * i + 1 < limit) primes.push(2 * i + 1)
  return Uint32Array.from(primes)
}

/** A sieve limit with at least `count` primes below it (p_n < n(ln n + ln ln n) for n ≥ 6). */
function limitForPrimes(count: number): number {
  if (count < 6) return 14
  return Math.ceil(count * (Math.log(count) + Math.log(Math.log(count)))) + 1
}

/** The first `count` primes. */
export function firstPrimes(count: number): Uint32Array {
  checkCount(count)
  const primes = primesBelow(limitForPrimes(count))
  return primes.subarray(0, count)
}

/** 2, 3, 5, 7, 11, … written out: the digits of the Copeland–Erdős constant 0.235711131719… */
export function primeConcatDigits(count: number): Uint8Array {
  checkCount(count)
  // Sieve further until the primes written out reach `count` digits.
  for (let limit = Math.max(100, count * 3); ; limit *= 2) {
    const primes = primesBelow(limit)
    let digits = 0
    for (let n = 0; n < primes.length && digits < count; n++) digits += String(primes[n]).length
    if (digits < count) continue
    let n = 0
    return writeTerms(count, () => String(primes[n++]))
  }
}

/** The last digit of 2, 3, 5, 7, 11, …: 2 3 5 7 1 3 7 9 3 9 1 … */
export function primeLastDigits(count: number): Uint8Array {
  return Uint8Array.from(firstPrimes(count), (p) => p % 10)
}
