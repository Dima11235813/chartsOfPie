import { useId, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { findDigits, MAX_SEARCH_DIGITS, searchPattern } from '../core/digits/findDigits'
import { placesIn } from '../core/series/series'
import { useNumber } from './numberContext'

interface StartPanelProps {
  /** All the digits loaded (position 0 is the leading 3, position n the n-th decimal place). */
  full: DigitSource
  /** Decimal place the performance starts at now. */
  start: number
  onStart: (start: number) => void
}

/** Six 9s in a row: the Feynman point, found in the data rather than hard-coded. */
const FEYNMAN = '999999'

/**
 * "Where in π" (S01.7.1): start anywhere in the digits instead of at 3.14159… — type a decimal
 * place, jump to a famous spot, pick one at random, or search for a sequence such as a birthday.
 * Every limit comes from the data loaded, so a longer data file needs no change here.
 */
export function StartPanel({ full, start, onStart }: StartPanelProps) {
  const ids = { place: useId(), find: useId() }
  const last = full.length - 1
  const number = useNumber()
  /** "decimal place" for constants, "digit" for whole-number sequences. */
  const placeWord = number.place
  const loadedCount = placesIn(number, full.length).toLocaleString()
  /** The first digits as a decimal, e.g. 3.14159 for π. */
  const opening =
    number.kind === 'constant'
      ? `${full.digitAt(0)}.${Array.from({ length: Math.min(5, last) }, (_, i) => full.digitAt(i + 1)).join('')}`
      : Array.from({ length: Math.min(9, full.length) }, (_, i) => full.digitAt(i)).join(' ')
  const [place, setPlace] = useState(String(start))
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ digits: string; at: number } | null>(null)
  const [status, setStatus] = useState('')

  const go = (at: number, message: string) => {
    onStart(at)
    setPlace(String(at))
    setStatus(message)
  }

  const goToPlace = () => {
    const at = Number(place.replace(/[,\s_]/g, ''))
    if (!Number.isInteger(at) || at < 0 || at > last) {
      setStatus(`Pick a ${placeWord} from 0 to ${last.toLocaleString()}.`)
      return
    }
    go(at, `Starting at ${placeWord} ${at.toLocaleString()}.`)
  }

  const find = (from: number) => {
    const digits = searchPattern(query)
    if (!digits) {
      setStatus(`Type 1 to ${MAX_SEARCH_DIGITS} digits to look for, e.g. a date like 14/03.`)
      return
    }
    const at = findDigits(full, digits, from)
    if (at < 0) {
      setFound(null)
      setStatus(
        from > 0
          ? `No more ${digits} in the first ${loadedCount} ${placeWord}s.`
          : `${digits} isn’t in the first ${loadedCount} ${placeWord}s.`,
      )
      return
    }
    setFound({ digits, at })
    go(at, `Found ${digits} at ${placeWord} ${at.toLocaleString()}.`)
  }

  return (
    <section className="export-panel start-panel" aria-labelledby="start-heading">
      <h2 id="start-heading">Where in {number.symbol}</h2>
      <p className="hint">
        {start === 0
          ? `Starting at the beginning, ${opening}… — ${loadedCount} ${placeWord}s loaded.`
          : `Starting at ${placeWord} ${start.toLocaleString()} of ${last.toLocaleString()}.`}
      </p>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault()
          goToPlace()
        }}
      >
        <label htmlFor={ids.place}>{placeWord[0]!.toUpperCase() + placeWord.slice(1)}</label>
        <span className="inline-row">
          <input
            id={ids.place}
            className="text-input"
            inputMode="numeric"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
          <button type="submit" className="btn">
            Go
          </button>
        </span>
      </form>
      <div className="inline-row start-picks">
        <button
          type="button"
          className="btn btn-small"
          disabled={start === 0}
          onClick={() => go(0, 'Back to the beginning.')}
        >
          Beginning
        </button>
        {number.id === 'pi' && (
          // The Feynman point is a fact about π; other numbers keep Beginning and Random.
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              const at = findDigits(full, FEYNMAN)
              if (at >= 0) go(at, `The Feynman point: six 9s in a row at decimal place ${at}.`)
            }}
          >
            Feynman point
          </button>
        )}
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            const at = 1 + Math.floor(Math.random() * last)
            go(at, `Somewhere random: ${placeWord} ${at.toLocaleString()}.`)
          }}
        >
          Random
        </button>
      </div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault()
          // Constants: skip the integer part (π's leading 3); sequences search from their start.
          find(number.kind === 'constant' ? 1 : 0)
        }}
      >
        <label htmlFor={ids.find}>Find digits</label>
        <span className="inline-row">
          <input
            id={ids.find}
            className="text-input"
            inputMode="numeric"
            placeholder="e.g. your birthday, 1403"
            value={query}
            maxLength={40}
            onChange={(e) => {
              setQuery(e.target.value)
              setFound(null)
            }}
          />
          <button type="submit" className="btn">
            Find
          </button>
        </span>
      </form>
      {found && (
        <button type="button" className="btn btn-small" onClick={() => find(found.at + 1)}>
          Find next {found.digits}
        </button>
      )}
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
