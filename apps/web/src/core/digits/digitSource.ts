/**
 * A finite, indexable stream of small symbols — the digits of π today, any series reading later
 * (proj-mgmt R-011). Everything downstream (engine, counts, sound, views) reads only this.
 */
export interface DigitSource {
  readonly id: string
  readonly name: string
  /** Number of symbols available. */
  readonly length: number
  /**
   * Symbol at a zero-based position, in 0..alphabetSize-1 (a decimal digit for every source so
   * far). Position 0 of π is the leading `3`.
   */
  digitAt(index: number): number
  /** How many distinct symbols the source can produce; absent means 10 (decimal digits). */
  readonly alphabetSize?: number
  /**
   * Where index 0 sits in the full sequence, for a source that starts part-way in (see
   * `windowFrom`); 0 or absent for a source that starts at the beginning.
   */
  readonly offset?: number
  /**
   * For sequences of whole numbers: which term each symbol belongs to, in absolute positions
   * (a window keeps its source's index; add `offset`). Absent for constants.
   */
  readonly terms?: TermIndex
}

/** Where each term's symbols start, for readings of whole-number sequences (R-011 §3, pass 4). */
export interface TermIndex {
  /** Number of terms (wholly or partly) present. */
  readonly count: number
  /** Position of the first symbol of term k (k from 0). */
  startOf(term: number): number
  /** The term the symbol at `position` belongs to. */
  termAt(position: number): number
}

/** Every source a series reading produces is a `SymbolSource`; digits are the alphabet-10 case. */
export type SymbolSource = DigitSource

export const DECIMAL_ALPHABET = 10

/** The number of distinct symbols a source can produce. */
export const alphabetOf = (source: Pick<DigitSource, 'alphabetSize'>) =>
  source.alphabetSize ?? DECIMAL_ALPHABET

/**
 * The same digits starting at `start` of `source`: index 0 is `source.digitAt(start)`. Playback
 * uses this to begin anywhere (e.g. at the Feynman point) while every view still sees a
 * performance that starts at 0; `offset` gives the absolute position back for labels.
 */
export function windowFrom(source: DigitSource, start: number): DigitSource {
  const base = source.offset ?? 0
  const from = Math.min(Math.max(0, Math.floor(start)), source.length)
  if (from === 0) return source
  return {
    id: `${source.id}@${base + from}`,
    name: source.name,
    length: source.length - from,
    offset: base + from,
    ...(source.alphabetSize === undefined ? {} : { alphabetSize: source.alphabetSize }),
    ...(source.terms === undefined ? {} : { terms: source.terms }),
    digitAt: (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= source.length - from) {
        throw new RangeError(`Digit index ${index} is outside 0..${source.length - from - 1}`)
      }
      return source.digitAt(from + index)
    },
  }
}

/**
 * Parse a block of text into digits. Whitespace and a single decimal point are ignored
 * so both `3.14159…` and `314159…` are accepted. Any other character is rejected.
 */
export function parseDigits(text: string): Uint8Array {
  const cleaned = text.replace(/\s+/g, '').replace('.', '')
  const digits = new Uint8Array(cleaned.length)
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i) - 48
    if (code < 0 || code > 9) {
      throw new Error(`Invalid digit ${JSON.stringify(cleaned[i])} at position ${i}`)
    }
    digits[i] = code
  }
  return digits
}

export function createDigitSource(id: string, name: string, digits: Uint8Array): DigitSource {
  return {
    id,
    name,
    length: digits.length,
    digitAt(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= digits.length) {
        throw new RangeError(`Digit index ${index} is outside 0..${digits.length - 1}`)
      }
      return digits[index]!
    },
  }
}
