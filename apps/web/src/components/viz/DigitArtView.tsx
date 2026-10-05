import { useEffect, useRef, useState } from 'react'
import {
  MAX_MOSAIC_COLUMNS,
  MIN_MOSAIC_COLUMNS,
  type ViewOptions,
} from '../../core/piece/visualConfig'
import { sweepColumns } from '../../viz/art'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { ART, type ArtKind } from '../../viz/render/registry'
import type { DigitRenderer } from '../../viz/render/renderer'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'
import { useDigitFeed } from './useDigitFeed'

interface DigitArtViewProps {
  kind: ArtKind
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
  /** Neighbour mosaic only: columns (0 = fill the width), groups-only filter, sweep. */
  mosaic?: ViewOptions['mosaic']
  onMosaicChange?: (change: Partial<ViewOptions['mosaic']>) => void
}

/** Sweep pace (columns per second); slower when the user prefers reduced motion. */
const SWEEP_SPEED = 2.5
const GROUP_CHOICES = [0, 2, 3, 4, 5] as const

/**
 * A growing artwork driven by the digits as they play (digit ring, π walk, sunflower, mosaic).
 * Drawing lives in the renderer (viz/render), shared with posters; this component only feeds it
 * digits once per animation frame and rebuilds it on reset, resize or palette change.
 */
export function DigitArtView({
  kind,
  source,
  log,
  onCanvas,
  mosaic,
  onMosaicChange,
}: DigitArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const definition = ART[kind]
  const renderer = useRef<DigitRenderer | null>(null)
  const [summary, setSummary] = useState('No digits yet.')
  const [shownColumns, setShownColumns] = useState(0)
  const shownRef = useRef(0)
  const columns = mosaic?.columns ?? 0
  const minGroup = mosaic?.minGroup ?? 0
  const sweep = kind === 'mosaic' && Boolean(mosaic?.sweep)

  // Sweep: animate the column count between half and one-and-a-half times the starting width and
  // back. Only this view changes; the saved setting stays the chosen width.
  const [swept, setSwept] = useState<number | null>(null)
  useEffect(() => {
    if (!sweep) return
    const base = columns || shownRef.current || 12
    const low = Math.max(MIN_MOSAIC_COLUMNS, Math.round(base / 2))
    const high = Math.min(MAX_MOSAIC_COLUMNS, Math.max(low + 2, Math.round(base * 1.5)))
    const speed = prefersReducedMotion() ? SWEEP_SPEED / 4 : SWEEP_SPEED
    const start = performance.now()
    // Start at the chosen width: offset the triangle wave so t = 0 lands on `base`.
    const offset = (Math.min(high, Math.max(low, base)) - low) / speed
    const timer = setInterval(() => {
      const t = (performance.now() - start) / 1000 + offset
      setSwept(sweepColumns(t, low, high, speed))
    }, 80)
    return () => clearInterval(timer)
  }, [sweep, columns])
  const layoutColumns = sweep && swept !== null ? swept : columns
  const describe = (count: number) => {
    const cols = renderer.current?.columns?.()
    if (cols) {
      setShownColumns(cols)
      shownRef.current = cols
    }
    if (count === 0) return 'No digits yet.'
    if (kind !== 'mosaic' || !cols) return definition.summary(count)
    const groups =
      minGroup > 1 ? ` Showing only groups of ${minGroup} or more equal neighbours.` : ''
    return `${count.toLocaleString()} digits in ${cols} columns. A vertical link joins equal digits ${cols} places apart; a diagonal one, ${cols - 1} or ${cols + 1} apart.${groups}`
  }

  const compose = () => {
    const canvas = canvasRef.current
    if (!canvas || !renderer.current) return
    const chord = log.chords.at(-1)
    const chordDigits =
      chord && log.lastStep && chord.index === log.lastStep.index
        ? new Set(chord.notes.map((note) => note.digit))
        : undefined
    renderer.current.compose(canvas.getContext('2d')!, { highlight: true, chordDigits })
  }

  useDigitFeed(
    log,
    `${kind}:${size.width}x${size.height}:${colors.join()}:${layoutColumns}:${minGroup}`,
    {
      reset() {
        const canvas = canvasRef.current
        if (!canvas || size.width === 0) return
        renderer.current = definition.live(
          {
            width: canvas.width,
            height: canvas.height,
            scale: size.ratio,
            colors,
            ghost: { count: source.length, digitAt: (i) => source.digitAt(i) },
          },
          { mosaicColumns: layoutColumns || undefined, mosaicMinGroup: minGroup },
        )
        compose()
        setSummary(describe(0))
      },
      draw(from, to) {
        if (!renderer.current) return
        renderer.current.draw(from, to, (i) => source.digitAt(i))
        compose()
        setSummary(describe(to))
      },
    },
  )

  const canvas = (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`${definition.describe} ${summary}`}
    />
  )
  if (kind !== 'mosaic' || !onMosaicChange) return canvas

  const fit = columns === 0
  const current = sweep ? shownColumns || columns : fit ? shownColumns || 10 : columns
  const set = (value: number) =>
    onMosaicChange({
      columns: Math.min(MAX_MOSAIC_COLUMNS, Math.max(MIN_MOSAIC_COLUMNS, Math.round(value))),
    })
  return (
    <div className="viz-layer viz-layer-with-bar">
      {canvas}
      <div className="viz-columns" role="group" aria-label="Mosaic width">
        <label className="viz-columns-fit">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => (e.target.checked ? onMosaicChange({ columns: 0 }) : set(current))}
          />
          Fit
        </label>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Fewer columns"
          onClick={() => set(current - 1)}
          disabled={current <= MIN_MOSAIC_COLUMNS && !fit}
        >
          −
        </button>
        <input
          type="range"
          aria-label="Columns"
          min={MIN_MOSAIC_COLUMNS}
          max={MAX_MOSAIC_COLUMNS}
          value={current}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-icon"
          aria-label="More columns"
          onClick={() => set(current + 1)}
          disabled={current >= MAX_MOSAIC_COLUMNS && !fit}
        >
          +
        </button>
        <output className="viz-columns-count" aria-live={sweep ? 'off' : 'polite'}>
          {current} columns
        </output>
        <label className="viz-columns-select">
          Show
          <select
            value={minGroup}
            onChange={(e) => onMosaicChange({ minGroup: Number(e.target.value) })}
          >
            {GROUP_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Every digit' : `Groups of ${n}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="viz-columns-fit">
          <input
            type="checkbox"
            checked={sweep}
            onChange={(e) => onMosaicChange({ sweep: e.target.checked })}
          />
          Sweep
        </label>
      </div>
    </div>
  )
}
