import { useMemo } from 'react'
import type { CoincidentChord } from '../core/composition/performanceLog'
import type { DigitSource } from '../core/digits/digitSource'
import { benfordShare, describePosition, firstDigitCounts } from '../core/series/fibonacci'
import type { StepEvent } from '../core/engine/playbackEngine'
import { useNumber } from './numberContext'
import { useDigitColors } from './palette'

interface StatsPanelProps {
  counts: readonly number[]
  total: number
  lastStep: StepEvent | null
  recent: readonly (readonly [number, number])[]
  lastChord?: CoincidentChord | null
  /** Decimal place the performance started at: step i is decimal place offset + i. */
  offset?: number
  /** What is playing: whole-number sequences add the term and a first-digit (Benford) table. */
  source?: DigitSource
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

export function StatsPanel({
  counts,
  total,
  lastStep,
  recent,
  lastChord,
  offset = 0,
  source,
}: StatsPanelProps) {
  const { place } = useNumber()
  const Place = place[0]!.toUpperCase() + place.slice(1)
  const colors = useDigitColors()
  const term = source && lastStep ? describePosition(source, offset + lastStep.index) : ''
  // Concatenated terms only (a periodic one-per-term reading has no first digits to speak of).
  const firstDigits = useMemo(() => {
    const terms = source?.terms
    if (!source || !terms || source.period || total === 0) return null
    const absolute = { digitAt: (at: number) => source.digitAt(at - offset) }
    const counts = firstDigitCounts(absolute, terms, offset, offset + total)
    const sum = counts.reduce((a, b) => a + b, 0)
    return sum > 0 ? { counts, sum } : null
  }, [source, offset, total])
  return (
    <div className="stats">
      <section aria-labelledby="stream-heading">
        <h2 id="stream-heading">Digit stream</h2>
        <p className="stream" aria-live="off">
          {recent.length === 0 ? (
            <span className="muted">
              {offset === 0
                ? 'Press Play to start at 3.14159…'
                : `Press Play to start at ${place} ${offset.toLocaleString()}.`}
            </span>
          ) : (
            recent.map(([index, digit], i) => (
              <span
                key={index}
                className={i === recent.length - 1 ? 'digit current' : 'digit'}
                style={{ color: colors[digit] }}
                title={`${Place} ${(offset + index).toLocaleString()}`}
              >
                {digit}
              </span>
            ))
          )}
        </p>
      </section>

      <dl className="readout">
        <div>
          <dt>Iteration</dt>
          <dd data-testid="total-count">{total.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{Place}</dt>
          <dd data-testid="decimal-place">
            {lastStep ? (offset + lastStep.index).toLocaleString() : '–'}
          </dd>
        </div>
        {term && (
          <div>
            <dt>Term</dt>
            <dd data-testid="term">{term}</dd>
          </div>
        )}
        <div>
          <dt>Current digit</dt>
          <dd data-testid="current-digit">{lastStep ? lastStep.digit : '–'}</dd>
        </div>
        <div>
          <dt>Now playing</dt>
          <dd data-testid="sound-data">
            {lastStep
              ? lastStep.note
                ? `${lastStep.note} for ${lastStep.durationLabel}`
                : 'rest'
              : '–'}
          </dd>
        </div>
        <div
          className="readout-wide"
          title="Chords formed when overlapping notes happen to line up"
        >
          <dt>Last chord (by coincidence)</dt>
          <dd data-testid="last-chord">
            {lastChord
              ? `${lastChord.chord.symbol} — ${lastChord.chord.quality.name} at ${place} ${(offset + lastChord.index).toLocaleString()}`
              : '–'}
          </dd>
        </div>
      </dl>

      <table className="ratios">
        <caption>How often each digit has appeared</caption>
        <thead>
          <tr>
            <th scope="col">Digit</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {counts.map((count, digit) => (
            <tr key={digit} className={lastStep?.digit === digit ? 'active' : undefined}>
              <th scope="row">
                <span className="swatch" style={{ background: colors[digit] }} />
                {digit}
              </th>
              <td>{count.toLocaleString()}</td>
              <td>{formatPercent(total === 0 ? 0 : count / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {firstDigits && (
        <table className="ratios" data-testid="first-digits">
          <caption>
            First digit of each number so far ({firstDigits.sum.toLocaleString()}): Benford’s law
            predicts 1 most often, 9 least
          </caption>
          <thead>
            <tr>
              <th scope="col">First digit</th>
              <th scope="col">Count</th>
              <th scope="col">Share</th>
              <th scope="col">Benford</th>
            </tr>
          </thead>
          <tbody>
            {firstDigits.counts.slice(1).map((count, i) => (
              <tr key={i + 1}>
                <th scope="row">
                  <span className="swatch" style={{ background: colors[i + 1] }} />
                  {i + 1}
                </th>
                <td>{count.toLocaleString()}</td>
                <td>{formatPercent(count / firstDigits.sum)}</td>
                <td>{formatPercent(benfordShare(i + 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
