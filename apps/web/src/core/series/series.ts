import { DECIMAL_ALPHABET } from '../digits/digitSource'

/*
 * Number series (proj-mgmt R-011). A series produces terms (the digits of a constant, or integers
 * such as Fibonacci numbers); a reading turns terms into symbols with a declared alphabet size.
 * Everything downstream plays and draws the resulting `SymbolSource`, so a new series is a data or
 * generator change, not a pipeline change.
 *
 * Ids are persisted in share links (`s=`) and saved pieces: never rename or remove one. Adding
 * one is fine; an app that meets an id it does not know treats the link or piece as written by a
 * newer version (sourceConfig.ts).
 *
 * This file and sourceConfig.ts are metadata only (the API validates pieces with them); fetching
 * and generating the symbols lives in load.ts.
 */

export const SERIES_IDS = ['pi', 'phi', 'e', 'sqrt2', 'fibonacci'] as const
export type SeriesId = (typeof SERIES_IDS)[number]

export const READING_IDS = ['digits', 'concat', 'last-digit'] as const
export type ReadingId = (typeof READING_IDS)[number]

export interface ReadingDefinition {
  readonly id: ReadingId
  readonly name: string
  readonly description: string
  /** Distinct symbols this reading produces (10 for decimal digits). */
  readonly alphabetSize: number
}

export const READINGS: readonly ReadingDefinition[] = [
  {
    id: 'digits',
    name: 'Digits',
    description: 'The decimal digits, one after another',
    alphabetSize: DECIMAL_ALPHABET,
  },
  {
    id: 'concat',
    name: 'All digits',
    description: 'Every digit of every term, one term after another: 0 1 1 2 3 5 8 1 3 2 1…',
    alphabetSize: DECIMAL_ALPHABET,
  },
  {
    id: 'last-digit',
    name: 'Last digit',
    description: 'The last digit of each term: a loop that repeats every 60 terms',
    alphabetSize: DECIMAL_ALPHABET,
  },
]

export interface SeriesDefinition {
  readonly id: SeriesId
  /** Full name, e.g. "π (pi)". */
  readonly name: string
  /** Short symbol used in labels, e.g. "π" in "π walk". */
  readonly symbol: string
  /** `constant`: digits of a number; `integers`: a sequence of whole numbers. */
  readonly kind: 'constant' | 'integers'
  /** What a position is called in labels: "decimal place" for constants, "digit" otherwise. */
  readonly place: string
  /** OEIS entry for the symbols as played (citation shown to listeners). */
  readonly oeis: string
  /** Readings that make sense for this series; the first is the default. */
  readonly readings: readonly [ReadingId, ...ReadingId[]]
}

export const SERIES: readonly SeriesDefinition[] = [
  {
    id: 'pi',
    name: 'π (pi)',
    symbol: 'π',
    kind: 'constant',
    place: 'decimal place',
    oeis: 'A000796',
    readings: ['digits'],
  },
  {
    id: 'phi',
    name: 'φ (golden ratio)',
    symbol: 'φ',
    kind: 'constant',
    place: 'decimal place',
    oeis: 'A001622',
    readings: ['digits'],
  },
  {
    id: 'e',
    name: 'e (Euler’s number)',
    symbol: 'e',
    kind: 'constant',
    place: 'decimal place',
    oeis: 'A001113',
    readings: ['digits'],
  },
  {
    id: 'sqrt2',
    name: '√2 (square root of 2)',
    symbol: '√2',
    kind: 'constant',
    place: 'decimal place',
    oeis: 'A002193',
    readings: ['digits'],
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci numbers',
    symbol: 'Fibonacci',
    kind: 'integers',
    place: 'digit',
    oeis: 'A000045',
    // All digits first (owner decision G-3, R-012); the 60-step last-digit loop second.
    readings: ['concat', 'last-digit'],
  },
]

/** How many symbols a series offers: constants count decimal places (after the integer part). */
export const placesIn = (series: SeriesDefinition, length: number) =>
  series.kind === 'constant' ? length - 1 : length

export const isSeriesId = (value: unknown): value is SeriesId =>
  SERIES_IDS.includes(value as SeriesId)

export const isReadingId = (value: unknown): value is ReadingId =>
  READING_IDS.includes(value as ReadingId)

export function getSeries(id: SeriesId): SeriesDefinition {
  const series = SERIES.find((s) => s.id === id)
  if (!series) throw new Error(`Unknown series: ${id}`)
  return series
}

export function getReading(id: ReadingId): ReadingDefinition {
  const reading = READINGS.find((r) => r.id === id)
  if (!reading) throw new Error(`Unknown reading: ${id}`)
  return reading
}

/** Put a series' symbol into label text written for π ("π walk" → "φ walk"). */
export const withSymbol = (text: string, symbol: string) =>
  symbol === 'π' ? text : text.replaceAll('π', symbol)
