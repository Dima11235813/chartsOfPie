import { createDigitSource, parseDigits, type DigitSource } from './digitSource'

/**
 * Digit files for φ, e and √2 (proj-mgmt F05.3), written by scripts/generate-constants.ts from
 * two independent computations each and pinned by sha256 in tests. Same layout as π: the integer
 * digit, then 1,000,000 decimals.
 */
export interface ConstantSpec {
  /** Series id (persisted; see core/series/series.ts). */
  readonly id: 'phi' | 'e' | 'sqrt2'
  readonly name: string
  readonly file: string
  /** First 100 digits, integer digit included (OEIS heads, cited per constant). */
  readonly first100: string
  /** Last ten digits of the bundled file. */
  readonly last10: string
}

export const CONSTANT_DIGIT_COUNT = 1_000_001

export const CONSTANTS: Readonly<Record<ConstantSpec['id'], ConstantSpec>> = {
  phi: {
    id: 'phi',
    name: 'φ (golden ratio)',
    file: 'phi-1m.txt',
    // OEIS A001622
    first100:
      '1618033988749894848204586834365638117720309179805762862135448622705260462818902449707207204189391137',
    last10: '4153226344',
  },
  e: {
    id: 'e',
    name: 'e (Euler’s number)',
    file: 'e-1m.txt',
    // OEIS A001113
    first100:
      '2718281828459045235360287471352662497757247093699959574966967627724076630353547594571382178525166427',
    last10: '7694228188',
  },
  sqrt2: {
    id: 'sqrt2',
    name: '√2 (square root of 2)',
    file: 'sqrt2-1m.txt',
    // OEIS A002193
    first100:
      '1414213562373095048801688724209698078569671875376948073176679737990732478462107038850387534327641572',
    last10: '9048412043',
  },
}

/** Parse and validate a constant's digit file, so a truncated or corrupted asset fails loudly. */
export function constantSourceFromText(spec: ConstantSpec, text: string): DigitSource {
  const digits = parseDigits(text)
  const head = Array.from(digits.subarray(0, spec.first100.length)).join('')
  if (digits.length < spec.first100.length || head !== spec.first100) {
    throw new Error(`${spec.name} digit data failed validation: unexpected leading digits`)
  }
  if (digits.length === CONSTANT_DIGIT_COUNT) {
    const tail = Array.from(digits.subarray(-spec.last10.length)).join('')
    if (tail !== spec.last10) {
      throw new Error(`${spec.name} digit data failed validation: unexpected trailing digits`)
    }
  }
  return createDigitSource(spec.id, spec.name, digits)
}

export async function loadConstantDigits(
  spec: ConstantSpec,
  url = `${import.meta.env.BASE_URL}data/${spec.file}`,
  fetchImpl: typeof fetch = fetch,
): Promise<DigitSource> {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Failed to load ${spec.name} (${response.status} ${response.statusText})`)
  }
  return constantSourceFromText(spec, await response.text())
}
