import { createDigitSource, parseDigits, type DigitSource } from './digitSource'

/**
 * First 100 digits of π (leading 3 included). Used to sanity-check the downloaded data file
 * so a truncated or corrupted asset fails loudly instead of playing the wrong music.
 */
export const PI_FIRST_100 =
  '3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067'

/** The bundled data file holds 3 followed by the first 1,000,000 decimals of π. */
export const PI_DIGIT_COUNT = 1_000_001

/** Last ten digits of the bundled file (decimals 999,991 – 1,000,000). */
export const PI_LAST_10 = '5779458151'

export function piSourceFromText(text: string): DigitSource {
  const digits = parseDigits(text)
  const head = Array.from(digits.subarray(0, PI_FIRST_100.length)).join('')
  if (head !== PI_FIRST_100.slice(0, head.length) || digits.length < PI_FIRST_100.length) {
    throw new Error('π digit data failed validation: unexpected leading digits')
  }
  if (digits.length === PI_DIGIT_COUNT) {
    const tail = Array.from(digits.subarray(-PI_LAST_10.length)).join('')
    if (tail !== PI_LAST_10) {
      throw new Error('π digit data failed validation: unexpected trailing digits')
    }
  }
  return createDigitSource('pi', 'π (pi)', digits)
}

export async function loadPiDigits(
  url = `${import.meta.env.BASE_URL}data/pi-1m.txt`,
  fetchImpl: typeof fetch = fetch,
): Promise<DigitSource> {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Failed to load π digits (${response.status} ${response.statusText})`)
  }
  return piSourceFromText(await response.text())
}
