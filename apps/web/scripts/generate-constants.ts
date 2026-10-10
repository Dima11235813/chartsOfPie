/*
 * Writes the digit files for φ, e and √2 (proj-mgmt F05.3): 1,000,001 digits each, the integer
 * digit first, like public/data/pi-1m.txt. Each constant is computed by two independent methods
 * and the files are written only if they agree. Run from apps/web:
 *
 *   node --experimental-strip-types scripts/generate-constants.ts
 *
 * Then update the sha256 pins in src/core/digits/constants.test.ts (they must not change unless
 * the data was wrong).
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  eDigitsByContinuedFraction,
  eDigitsBySeries,
  phiDigitsByFibonacci,
  phiDigitsBySqrt,
  sqrt2DigitsByPell,
  sqrt2DigitsBySqrt,
} from '../src/core/digits/constantDigits.ts'

const COUNT = 1_000_001

const CONSTANTS = [
  { file: 'phi-1m.txt', methods: [phiDigitsBySqrt, phiDigitsByFibonacci] },
  { file: 'e-1m.txt', methods: [eDigitsBySeries, eDigitsByContinuedFraction] },
  { file: 'sqrt2-1m.txt', methods: [sqrt2DigitsBySqrt, sqrt2DigitsByPell] },
]

for (const { file, methods } of CONSTANTS) {
  const [first, second] = methods.map((method) => {
    const started = performance.now()
    const digits = method(COUNT)
    console.log(`${file}: ${method.name} in ${Math.round(performance.now() - started)} ms`)
    return digits
  })
  if (first !== second) throw new Error(`${file}: the two methods disagree; nothing written`)
  writeFileSync(new URL(`../public/data/${file}`, import.meta.url), first)
  console.log(`${file}: sha256 ${createHash('sha256').update(first).digest('hex')}`)
}
