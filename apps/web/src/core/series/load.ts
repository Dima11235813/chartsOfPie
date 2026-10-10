import { createDigitSource, type SymbolSource } from '../digits/digitSource'
import { CONSTANTS, loadConstantDigits } from '../digits/constants'
import {
  fibonacciConcatDigits,
  fibonacciLastDigits,
  primeConcatDigits,
  primeLastDigits,
} from '../digits/integerSequences'
import { loadPiDigits } from '../digits/pi'
import { getSeries, type ReadingId, type SeriesId } from './series'
import { sourceKey, sourceName, type SourceConfig } from './sourceConfig'

/** Symbols generated for a whole-number sequence: as many as the constants' decimal places. */
export const SEQUENCE_DIGIT_COUNT = 1_000_000

type Generator = (count: number) => Uint8Array

const generate = (generators: Partial<Record<ReadingId, Generator>>) => (config: SourceConfig) => {
  const generator = generators[config.reading]
  if (!generator) throw new Error(`${getSeries(config.series).name} has no ${config.reading}`)
  return createDigitSource(sourceKey(config), sourceName(config), generator(SEQUENCE_DIGIT_COUNT))
}

/** How each series obtains its symbols: a verified data file, or a pure generator. */
const LOADERS: Record<SeriesId, (config: SourceConfig) => Promise<SymbolSource> | SymbolSource> = {
  pi: () => loadPiDigits(),
  phi: () => loadConstantDigits(CONSTANTS.phi),
  e: () => loadConstantDigits(CONSTANTS.e),
  sqrt2: () => loadConstantDigits(CONSTANTS.sqrt2),
  // Well under a second each on a desktop (R-011 §1); generated once per session.
  fibonacci: generate({ concat: fibonacciConcatDigits, 'last-digit': fibonacciLastDigits }),
  primes: generate({ concat: primeConcatDigits, 'last-digit': primeLastDigits }),
}

const loaded = new Map<string, Promise<SymbolSource>>()

/** Fetch or generate the symbols a source config names (once per session for each). */
export function loadSource(config: SourceConfig): Promise<SymbolSource> {
  const key = sourceKey(config)
  let source = loaded.get(key)
  if (!source) {
    source = (async () => LOADERS[config.series](config))()
    // A failed fetch can be retried by choosing the number again.
    source.catch(() => loaded.delete(key))
    loaded.set(key, source)
  }
  return source
}
