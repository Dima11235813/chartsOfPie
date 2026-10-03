// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createDigitSource, parseDigits } from './digitSource'
import { DigitCounter } from './digitCounter'
import { loadPiDigits, PI_DIGIT_COUNT, PI_FIRST_100, piSourceFromText } from './pi'

const repoFile = (path: string) => fileURLToPath(new URL(`../../../../../${path}`, import.meta.url))
const bundledPi = readFileSync(repoFile('apps/web/public/data/pi-1m.txt'), 'utf8')

describe('parseDigits', () => {
  it('accepts plain and decimal-point forms', () => {
    expect(Array.from(parseDigits('3.1415'))).toEqual([3, 1, 4, 1, 5])
    expect(Array.from(parseDigits(' 31\n415 '))).toEqual([3, 1, 4, 1, 5])
  })

  it('rejects non-digits', () => {
    expect(() => parseDigits('31a4')).toThrow(/Invalid digit "a" at position 2/)
  })
})

describe('createDigitSource', () => {
  it('bounds-checks access', () => {
    const source = createDigitSource('t', 'test', parseDigits('123'))
    expect(source.digitAt(2)).toBe(3)
    expect(() => source.digitAt(3)).toThrow(RangeError)
    expect(() => source.digitAt(-1)).toThrow(RangeError)
  })
})

describe('DigitCounter', () => {
  it('tracks counts, min, max and ratios', () => {
    const counter = new DigitCounter()
    for (const d of [3, 1, 4, 1, 5]) counter.record(d)
    expect(counter.counts).toEqual([0, 2, 0, 1, 1, 1, 0, 0, 0, 0])
    expect(counter.total).toBe(5)
    expect(counter.min).toBe(0)
    expect(counter.max).toBe(2)
    expect(counter.ratios[1]).toBeCloseTo(0.4)
    counter.reset()
    expect(counter.total).toBe(0)
    expect(counter.ratios.every((r) => r === 0)).toBe(true)
  })

  it('rejects non-digits', () => {
    expect(() => new DigitCounter().record(10)).toThrow(RangeError)
  })
})

describe('bundled π data', () => {
  it('has one million decimals and a known checksum', () => {
    expect(bundledPi.length).toBe(PI_DIGIT_COUNT)
    expect(createHash('sha256').update(bundledPi).digest('hex')).toBe(
      '130203eb055a962b8441af76c22b75627ec18c672a485904e567f59251e8ee18',
    )
    const source = piSourceFromText(bundledPi)
    expect(source.length).toBe(PI_DIGIT_COUNT)
  })

  it('matches the legacy pie_mill.js digits exactly', () => {
    const legacy = readFileSync(repoFile('legacy/simpleHtml/pie_mill.js'), 'utf8')
    const digits = legacy
      .slice(legacy.indexOf('`') + 1, legacy.lastIndexOf('`'))
      .replace(/\s|\./g, '')
    expect(digits).toBe(bundledPi)
  })

  it('matches the legacy index.js digits apart from the known corruption (bug B-001)', () => {
    const legacy = readFileSync(repoFile('legacy/simpleHtml/index.js'), 'utf8')
    const start = legacy.indexOf('`') + 1
    const digits = legacy.slice(start, legacy.indexOf('`', start))
    const corruptionAt = 999_638
    expect(digits.slice(0, corruptionAt)).toBe(bundledPi.slice(0, corruptionAt))
    expect(digits.slice(corruptionAt, corruptionAt + 3)).toBe('999')
    expect(digits.slice(corruptionAt + 3)).toBe(bundledPi.slice(corruptionAt))
  })

  it('validation rejects corrupted data', () => {
    expect(() => piSourceFromText('2718281828459045')).toThrow(/leading digits/)
    const badTail = bundledPi.slice(0, -1) + '0'
    expect(() => piSourceFromText(badTail)).toThrow(/trailing digits/)
    expect(piSourceFromText(PI_FIRST_100).length).toBe(100)
  })

  it('loadPiDigits fetches and validates', async () => {
    const ok = await loadPiDigits('/x', async () => new Response(PI_FIRST_100))
    expect(ok.digitAt(0)).toBe(3)
    await expect(loadPiDigits('/x', async () => new Response('', { status: 404 }))).rejects.toThrow(
      /404/,
    )
  })
})
