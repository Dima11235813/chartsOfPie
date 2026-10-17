import { createDigitSource, type SymbolSource } from '../digits/digitSource'
import { CONSTANTS, loadConstantDigits } from '../digits/constants'
import { loadPiDigits } from '../digits/pi'
import { fibonacciConcatenated, fibonacciResidues, pisanoPeriod } from './fibonacci'
import type { ReadingId, SeriesId } from './series'
import type { SourceConfig } from './sourceConfig'

/** How each series obtains its symbols: a verified data file, or (later) a pure generator. */
const LOADERS: Record<SeriesId, (reading: ReadingId) => Promise<SymbolSource>> = {
  pi: () => loadPiDigits(),
  phi: () => loadConstantDigits(CONSTANTS.phi),
  e: () => loadConstantDigits(CONSTANTS.e),
  sqrt2: () => loadConstantDigits(CONSTANTS.sqrt2),
  fibonacci: async (reading) => loadFibonacci(reading),
}

/** Symbols of a generated sequence, as many as a constant's data file holds. */
export const GENERATED_LENGTH = 1_000_000

/** Residue readings of Fibonacci: the modulus each one takes. */
const FIBONACCI_MODULI: Partial<Record<ReadingId, number>> = { 'last-digit': 10, 'mod-12': 12 }

/** Fibonacci is generated, not fetched: ~35 ms for a million digits (3,094 BigInt terms). */
function loadFibonacci(reading: ReadingId): SymbolSource {
  if (reading === 'base-12') {
    const { symbols, terms } = fibonacciConcatenated(GENERATED_LENGTH, 12)
    const source = createDigitSource('fibonacci:base-12', 'Fibonacci numbers · base 12', symbols)
    return { ...source, terms, alphabetSize: 12 }
  }
  const modulus = FIBONACCI_MODULI[reading]
  if (modulus === undefined) {
    const { symbols, terms } = fibonacciConcatenated(GENERATED_LENGTH)
    return { ...createDigitSource('fibonacci', 'Fibonacci numbers', symbols), terms }
  }
  const { symbols, terms } = fibonacciResidues(GENERATED_LENGTH, modulus)
  const source = createDigitSource(
    `fibonacci:${reading}`,
    `Fibonacci numbers · ${reading === 'last-digit' ? 'last digit' : `mod ${modulus}`}`,
    symbols,
  )
  return {
    ...source,
    terms,
    period: pisanoPeriod(modulus),
    ...(modulus === 10 ? {} : { alphabetSize: modulus }),
  }
}

/** Fetch or generate the symbols a source config names. */
export function loadSource(config: SourceConfig): Promise<SymbolSource> {
  return LOADERS[config.series](config.reading)
}
