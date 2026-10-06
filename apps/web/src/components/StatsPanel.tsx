import type { CoincidentChord } from '../core/composition/performanceLog'
import type { StepEvent } from '../core/engine/playbackEngine'
import { useDigitColors } from './palette'

interface StatsPanelProps {
  counts: readonly number[]
  total: number
  lastStep: StepEvent | null
  recent: readonly (readonly [number, number])[]
  lastChord?: CoincidentChord | null
  /** Decimal place the performance started at: step i is decimal place offset + i. */
  offset?: number
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

export function StatsPanel({
  counts,
  total,
  lastStep,
  recent,
  lastChord,
  offset = 0,
}: StatsPanelProps) {
  const colors = useDigitColors()
  return (
    <div className="stats">
      <section aria-labelledby="stream-heading">
        <h2 id="stream-heading">Digit stream</h2>
        <p className="stream" aria-live="off">
          {recent.length === 0 ? (
            <span className="muted">
              {offset === 0
                ? 'Press Play to start at 3.14159…'
                : `Press Play to start at decimal place ${offset.toLocaleString()}.`}
            </span>
          ) : (
            recent.map(([index, digit], i) => (
              <span
                key={index}
                className={i === recent.length - 1 ? 'digit current' : 'digit'}
                style={{ color: colors[digit] }}
                title={`Decimal place ${(offset + index).toLocaleString()}`}
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
          <dt>Decimal place</dt>
          <dd data-testid="decimal-place">
            {lastStep ? (offset + lastStep.index).toLocaleString() : '–'}
          </dd>
        </div>
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
              ? `${lastChord.chord.symbol} — ${lastChord.chord.quality.name} at decimal place ${(offset + lastChord.index).toLocaleString()}`
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
    </div>
  )
}
