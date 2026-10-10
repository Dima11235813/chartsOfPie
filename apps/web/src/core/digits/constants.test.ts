// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  eContinuedFractionTerm,
  eDigitsByContinuedFraction,
  eDigitsBySeries,
  fibonacciPair,
  isqrt,
  phiDigitsByFibonacci,
  phiDigitsBySqrt,
  sqrt2DigitsByPell,
  sqrt2DigitsBySqrt,
} from './constantDigits'
import {
  CONSTANT_DIGIT_COUNT,
  CONSTANTS,
  constantSourceFromText,
  loadConstantDigits,
} from './constants'

const bundled = (file: string) =>
  readFileSync(fileURLToPath(new URL(`../../../public/data/${file}`, import.meta.url)), 'utf8')

describe('exact arithmetic', () => {
  it('integer square roots are exact, also just below a square', () => {
    for (const n of [0n, 1n, 2n, 3n, 4n, 15n, 16n, 17n, 10n ** 40n, 10n ** 40n - 1n])
      expect(isqrt(n) ** 2n <= n && (isqrt(n) + 1n) ** 2n > n).toBe(true)
    const big = 12345678901234567890123456789n
    expect(isqrt(big * big)).toBe(big)
    expect(isqrt(big * big - 1n)).toBe(big - 1n)
  })

  it('Fibonacci by fast doubling: F(10) = 55, F(100) = 354224848179261915075 (OEIS A000045)', () => {
    expect(fibonacciPair(10)).toEqual([55n, 89n])
    expect(fibonacciPair(100)[0]).toBe(354224848179261915075n)
  })

  it("e's continued fraction is [2; 1, 2, 1, 1, 4, 1, 1, 6, 1] (OEIS A003417)", () => {
    expect(Array.from({ length: 10 }, (_, i) => eContinuedFractionTerm(i))).toEqual([
      2, 1, 2, 1, 1, 4, 1, 1, 6, 1,
    ])
  })
})

describe.each(Object.values(CONSTANTS))('$name', (spec) => {
  const methods = {
    phi: [phiDigitsBySqrt, phiDigitsByFibonacci],
    e: [eDigitsBySeries, eDigitsByContinuedFraction],
    sqrt2: [sqrt2DigitsBySqrt, sqrt2DigitsByPell],
  }[spec.id]
  const text = bundled(spec.file)

  it('both methods give the published first 100 digits', () => {
    for (const method of methods) expect(method(100)).toBe(spec.first100)
  })

  it('the bundled file is pinned and complete', () => {
    const pins = {
      phi: '055361b8775b0842ac5e392a9c2611aef328f2e180c37cacb90fd23c523ebf11',
      e: '431794a4857c0bda579b8854553088ad567c082495aefeca9e6c59c83b9ce07d',
      sqrt2: 'e1fbbd14d50d3f17d3a8ac073187d793f8ced39b0a836bf60578fa2d821ec2b3',
    }
    expect(createHash('sha256').update(text).digest('hex')).toBe(pins[spec.id])
    const source = constantSourceFromText(spec, text)
    expect(source).toMatchObject({ id: spec.id, length: CONSTANT_DIGIT_COUNT })
  })

  it('every digit of the file is recomputed exactly', () => {
    // The faster of the two methods (the generator checked both agree); ~0.5–1 s each.
    const fast = spec.id === 'e' ? methods[0]! : methods[1]!
    expect(fast(CONSTANT_DIGIT_COUNT) === text).toBe(true)
  }, 30_000)

  it('rejects corrupted data', () => {
    const wrongHead = `${spec.first100.slice(0, 50)}0${spec.first100.slice(51)}`
    expect(() => constantSourceFromText(spec, wrongHead)).toThrow(/leading digits/)
    const wrongTail = `${text.slice(0, -1)}${text.endsWith('0') ? '1' : '0'}`
    expect(() => constantSourceFromText(spec, wrongTail)).toThrow(/trailing digits/)
  })

  it('loads through fetch and reports HTTP errors', async () => {
    const ok = (async () => new Response(spec.first100)) as typeof fetch
    expect((await loadConstantDigits(spec, 'x', ok)).length).toBe(100)
    const missing = (async () => new Response('', { status: 404 })) as typeof fetch
    await expect(loadConstantDigits(spec, 'x', missing)).rejects.toThrow(/404/)
  })
})
