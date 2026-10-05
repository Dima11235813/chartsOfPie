import { useMemo, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { mosaicGroups, shapeCensus } from '../viz/mosaicShapes'
import { cellsOfKey, FREE_POLYPLET_COUNTS, shapeName } from '../viz/polyplets'
import { useThrottled } from '../hooks/useThrottled'

interface MosaicShapesPanelProps {
  source: DigitSource
  /** Digits played so far. */
  played: number
  /** Current column count of the mosaic (changes while sweeping). */
  columns: number
  selected: string | null
  onSelect: (shape: string | null) => void
}

/** Census window: the most recent digits (keeps it instant even after a long performance). */
const WINDOW = 20_000
const SIZES = [2, 3, 4, 5] as const
const CENSUS_EVERY_MS = 750

/** A shape drawn the way the mosaic draws groups: dots joined to their 8-way neighbours. */
function ShapeGlyph({ shape, size = 40 }: { shape: string; size?: number }) {
  const cells = cellsOfKey(shape)
  const span = Math.max(...cells.flatMap(([x, y]) => [x, y])) + 1
  const step = size / Math.max(3, span)
  const at = (v: number) => step / 2 + v * step + (size - span * step) / 2
  const links: [number, number, number, number][] = []
  cells.forEach(([x1, y1], a) =>
    cells.forEach(([x2, y2], b) => {
      if (b > a && Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1) links.push([x1, y1, x2, y2])
    }),
  )
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {links.map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1},${y1}-${x2},${y2}`}
          x1={at(x1)}
          y1={at(y1)}
          x2={at(x2)}
          y2={at(y2)}
          stroke="currentColor"
          strokeWidth={step * 0.22}
          strokeLinecap="round"
        />
      ))}
      {cells.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={at(x)} cy={at(y)} r={step * 0.3} fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * Shape census of the neighbour mosaic (R-009): every group of 2–5 equal neighbours is a
 * polyplet; this lists which shapes appear at the current width, how often, and how many of all
 * possible shapes have been collected across the widths visited. Picking a shape isolates it.
 */
export function MosaicShapesPanel({
  source,
  played,
  columns,
  selected,
  onSelect,
}: MosaicShapesPanelProps) {
  // Recount a few times a second, not on every digit (it scans up to 20,000 digits).
  const counted = useThrottled(played, CENSUS_EVERY_MS)
  const census = useMemo(() => {
    const played = counted
    const start = Math.max(0, played - WINDOW)
    const digits = new Uint8Array(played - start)
    for (let k = 0; k < digits.length; k++) digits[k] = source.digitAt(start + k)
    return shapeCensus(mosaicGroups(digits, columns, start, 2, 5))
  }, [source, counted, columns])

  // Shapes collected across every width shown since the last reset. Updated while rendering when
  // the census changes (React's pattern for state derived from changing props).
  const [collection, setCollection] = useState({
    census: null as typeof census | null,
    played: 0,
    seen: new Map<number, ReadonlySet<string>>(),
  })
  if (collection.census !== census) {
    const seen = new Map(played < collection.played ? [] : collection.seen)
    for (const { shape, size } of census) seen.set(size, new Set(seen.get(size)).add(shape))
    setCollection({ census, played, seen })
  }

  const total = census.reduce((sum, c) => sum + c.count, 0)
  return (
    <section className="export-panel shapes-panel" aria-labelledby="shapes-heading">
      <h2 id="shapes-heading">Shapes in the mosaic</h2>
      <p className="hint">
        {played === 0
          ? 'Play some digits: every group of equal neighbours is a shape.'
          : `${total.toLocaleString()} groups of 2–5 equal neighbours at ${columns} columns${played > WINDOW ? ` (last ${WINDOW.toLocaleString()} digits)` : ''}. Change the width — or sweep — to discover more shapes.`}
      </p>
      {selected && (
        <p className="undo-bar" role="status">
          Showing one shape only.{' '}
          <button type="button" className="btn btn-small" onClick={() => onSelect(null)}>
            Show all
          </button>
        </p>
      )}
      {SIZES.map((size) => {
        const here = census.filter((c) => c.size === size)
        const found = collection.seen.get(size)?.size ?? 0
        return (
          <div key={size} className="shape-size">
            <h3>
              {size} digits{' '}
              <span className="shape-progress">
                · found {found} of {FREE_POLYPLET_COUNTS[size]} shapes
              </span>
            </h3>
            {here.length === 0 ? (
              <p className="hint">None at this width.</p>
            ) : (
              <ul className="shape-list">
                {here.map((c) => {
                  const name = shapeName(c.shape)
                  const label = `${name ?? `${size}-digit shape`}: ${c.count} at this width`
                  return (
                    <li key={c.shape}>
                      <button
                        type="button"
                        className="shape-chip"
                        aria-pressed={selected === c.shape}
                        aria-label={label}
                        title={label}
                        onClick={() => onSelect(selected === c.shape ? null : c.shape)}
                      >
                        <ShapeGlyph shape={c.shape} />
                        <span className="shape-count">{c.count}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}
