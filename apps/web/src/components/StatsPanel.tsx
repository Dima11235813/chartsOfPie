import type { StepEvent } from '../core/engine/playbackEngine'
import { DIGIT_COLORS } from './chartConfig'

interface StatsPanelProps {
  counts: readonly number[]
  total: number
  lastStep: StepEvent | null
  recent: readonly (readonly [number, number])[]
}

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`

export function StatsPanel({ counts, total, lastStep, recent }: StatsPanelProps) {
  return (
    <div className="stats">
      <section aria-labelledby="stream-heading">
        <h2 id="stream-heading">Digit stream</h2>
        <p className="stream" aria-live="off">
          {recent.length === 0 ? (
            <span className="muted">Press Play to start at 3.14159…</span>
          ) : (
            recent.map(([index, digit], i) => (
              <span
                key={index}
                className={i === recent.length - 1 ? 'digit current' : 'digit'}
                style={{ color: DIGIT_COLORS[digit] }}
                title={`Digit #${index}`}
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
                <span className="swatch" style={{ background: DIGIT_COLORS[digit] }} />
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
