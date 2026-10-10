import { useMemo, useState } from 'react'
import type { DigitSource } from '../core/digits/digitSource'
import { mosaicGroups, shapeCensus } from '../viz/mosaicShapes'
import { cellsOfKey, FREE_POLYPLET_COUNTS, shapeName } from '../viz/polyplets'
import { useOnScreen } from '../hooks/useOnScreen'
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
const OPEN_KEY = 'charts-of-pie.shapes-panel.open'

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

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
  const [open, setOpenState] = useState(readOpen)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      localStorage.setItem(OPEN_KEY, String(next))
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  }
  // Count only what someone can see: not while the card is hidden, scrolled away, under a
  // full-screen stage or in a background tab. Recount a few times a second, not on every digit or
  // sweep step (it scans up to 20,000 digits); the last count stays until the card is back.
  const [onScreenRef, onScreen] = useOnScreen<HTMLElement>()
  const live = open && onScreen
  const latest = useThrottled(`${played}:${columns}`, CENSUS_EVERY_MS)
  const [counted, setCounted] = useState(latest)
  if (live && counted !== latest) setCounted(latest)
  const [countedPlayed, countedColumns] = counted.split(':').map(Number) as [number, number]
  const census = useMemo(() => {
    const start = Math.max(0, countedPlayed - WINDOW)
    const digits = new Uint8Array(countedPlayed - start)
    for (let k = 0; k < digits.length; k++) digits[k] = source.digitAt(start + k)
    return shapeCensus(mosaicGroups(digits, countedColumns, start, 2, 5))
  }, [source, countedPlayed, countedColumns])

  // Shapes collected across every width shown since the last reset. Updated while rendering when
  // the census changes (React's pattern for state derived from changing props).
  const [collection, setCollection] = useState({
    census: null as typeof census | null,
    played: 0,
    seen: new Map<number, ReadonlySet<string>>(),
  })
  if (collection.census !== census) {
    const seen = new Map(countedPlayed < collection.played ? [] : collection.seen)
    for (const { shape, size } of census) seen.set(size, new Set(seen.get(size)).add(shape))
    setCollection({ census, played: countedPlayed, seen })
  }

  const total = census.reduce((sum, c) => sum + c.count, 0)
  const toggle = (
    <button
      type="button"
      className="btn btn-small shapes-toggle"
      aria-expanded={open}
      aria-controls="shapes-body"
      onClick={() => setOpen(!open)}
    >
      {open ? 'Hide' : 'Show'}
    </button>
  )
  if (!open)
    return (
      <section
        ref={onScreenRef}
        className="export-panel shapes-panel"
        aria-labelledby="shapes-heading"
      >
        <h2 id="shapes-heading" className="shapes-heading">
          Shapes in the mosaic {toggle}
        </h2>
        {selected && (
          <p className="undo-bar" role="status">
            Showing one shape only.{' '}
            <button type="button" className="btn btn-small" onClick={() => onSelect(null)}>
              Show all
            </button>
          </p>
        )}
      </section>
    )
  return (
    <section
      ref={onScreenRef}
      className="export-panel shapes-panel"
      aria-labelledby="shapes-heading"
    >
      <h2 id="shapes-heading" className="shapes-heading">
        Shapes in the mosaic {toggle}
      </h2>
      <div id="shapes-body">
        <p className="hint">
          {countedPlayed === 0
            ? 'Play some digits: every group of equal neighbours is a shape.'
            : `${total.toLocaleString()} groups of 2–5 equal neighbours at ${countedColumns} columns${countedPlayed > WINDOW ? ` (last ${WINDOW.toLocaleString()} digits)` : ''}. Change the width — or sweep — to discover more shapes.`}
        </p>
        {source.period && (
          <p className="hint" data-testid="loop-note">
            This reading repeats every {source.period} digits, so once a loop has played no new
            shapes appear at this width — only another width shows others.
          </p>
        )}
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
      </div>
    </section>
  )
}
