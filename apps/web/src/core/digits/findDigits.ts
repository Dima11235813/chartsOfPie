import type { DigitSource } from './digitSource'

/** Longest sequence searched for (a date with the year is 8 digits). */
export const MAX_SEARCH_DIGITS = 20

const texts = new WeakMap<DigitSource, string>()

/** The whole source as a string of digits, built once per source (1 MB for a million digits). */
function textOf(source: DigitSource): string {
  let text = texts.get(source)
  if (text === undefined) {
    const chunks: string[] = []
    const CHUNK = 65_536
    for (let start = 0; start < source.length; start += CHUNK) {
      const end = Math.min(source.length, start + CHUNK)
      let chunk = ''
      for (let i = start; i < end; i++) chunk += source.digitAt(i)
      chunks.push(chunk)
    }
    text = chunks.join('')
    texts.set(source, text)
  }
  return text
}

/** `text` reduced to its digits, or null if that leaves nothing or too many to search for. */
export function searchPattern(text: string): string | null {
  const digits = text.replace(/\D/g, '')
  return digits.length >= 1 && digits.length <= MAX_SEARCH_DIGITS ? digits : null
}

/**
 * Position of the first occurrence of `digits` in `source` at or after `from`, or -1. Positions
 * count like the source does: in π, position 0 is the leading 3 and position n is the n-th
 * decimal place, so "999999" (the Feynman point) is found at 762.
 */
export function findDigits(source: DigitSource, digits: string, from = 0): number {
  if (!/^\d+$/.test(digits)) return -1
  return textOf(source).indexOf(digits, Math.max(0, from))
}
