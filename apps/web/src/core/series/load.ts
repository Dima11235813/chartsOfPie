import { createDigitSource, type SymbolSource } from '../digits/digitSource'
import { CONSTANTS, loadConstantDigits } from '../digits/constants'
import { loadPiDigits } from '../digits/pi'
import { fibonacciConcatenated, fibonacciLastDigits, PISANO_10 } from './fibonacci'
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

/** Fibonacci is generated, not fetched: ~35 ms for a million digits (3,094 BigInt terms). */
function loadFibonacci(reading: ReadingId): SymbolSource {
  const lastDigit = reading === 'last-digit'
  const { symbols, terms } = (lastDigit ? fibonacciLastDigits : fibonacciConcatenated)(
    GENERATED_LENGTH,
  )
  const source = createDigitSource(
    lastDigit ? 'fibonacci:last-digit' : 'fibonacci',
    lastDigit ? 'Fibonacci numbers · last digit' : 'Fibonacci numbers',
    symbols,
  )
  return { ...source, terms, ...(lastDigit ? { period: PISANO_10 } : {}) }
}

/** Fetch or generate the symbols a source config names. */
export function loadSource(config: SourceConfig): Promise<SymbolSource> {
  return LOADERS[config.series](config.reading)
}
