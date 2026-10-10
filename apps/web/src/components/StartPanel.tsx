import { useId, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { findDigits, MAX_SEARCH_DIGITS, searchPattern } from '../core/digits/findDigits'
import { placeName } from '../core/series/series'
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
  const place = placeName(number)
  const places = `${place}s`
  /** The first digits: as a decimal for a constant (3.14159 for π), as written for a sequence. */
  const head = Array.from({ length: Math.min(8, full.length) }, (_, i) => full.digitAt(i))
  const opening =
    number.kind === 'constant' ? `${head[0]}.${head.slice(1, 6).join('')}` : head.join('')
  const [at, setAt] = useState(String(start))
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ digits: string; at: number } | null>(null)
  const [status, setStatus] = useState('')

  const go = (at: number, message: string) => {
    onStart(at)
    setAt(String(at))
    setStatus(message)
  }

  const goToPlace = () => {
    const to = Number(at.replace(/[,\s_]/g, ''))
    if (!Number.isInteger(to) || to < 0 || to > last) {
      setStatus(`Pick a ${place} from 0 to ${last.toLocaleString()}.`)
      return
    }
    go(to, `Starting at ${place} ${to.toLocaleString()}.`)
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
          ? `No more ${digits} in the first ${last.toLocaleString()} ${places}.`
          : `${digits} isn’t in the first ${last.toLocaleString()} ${places}.`,
      )
      return
    }
    setFound({ digits, at })
    go(at, `Found ${digits} at ${place} ${at.toLocaleString()}.`)
  }

  return (
    <section className="export-panel start-panel" aria-labelledby="start-heading">
      <h2 id="start-heading">Where in {number.symbol}</h2>
      <p className="hint">
        {start === 0
          ? `Starting at the beginning, ${opening}… — ${last.toLocaleString()} ${places} loaded.`
          : `Starting at ${place} ${start.toLocaleString()} of ${last.toLocaleString()}.`}
      </p>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault()
          goToPlace()
        }}
      >
        <label htmlFor={ids.place}>{place[0]!.toUpperCase() + place.slice(1)}</label>
        <span className="inline-row">
          <input
            id={ids.place}
            className="text-input"
            inputMode="numeric"
            value={at}
            onChange={(e) => setAt(e.target.value)}
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
            go(at, `Somewhere random: ${place} ${at.toLocaleString()}.`)
          }}
        >
          Random
        </button>
      </div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault()
          find(1)
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
