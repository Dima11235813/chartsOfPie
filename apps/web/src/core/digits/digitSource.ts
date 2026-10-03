/** A finite, indexable stream of base-10 digits (e.g. the first million digits of π). */
export interface DigitSource {
  readonly id: string
  readonly name: string
  /** Number of digits available. */
  readonly length: number
  /** Digit (0–9) at a zero-based position. Position 0 of π is the leading `3`. */
  digitAt(index: number): number
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
