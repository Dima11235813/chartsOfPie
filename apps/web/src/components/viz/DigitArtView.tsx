import { withSymbol } from '../../core/series/series'
import { useNumber } from '../numberContext'
import { useRef, useState } from 'react'
import {
  MAX_MOSAIC_COLUMNS,
  MIN_MOSAIC_COLUMNS,
  type ViewOptions,
} from '../../core/piece/visualConfig'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { spiralNeighbours } from '../../viz/art'
import { ART, type ArtKind } from '../../viz/render/registry'
import type { DigitRenderer } from '../../viz/render/renderer'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { MosaicSweep } from './MosaicSweep'
import { useDigitFeed } from './useDigitFeed'

interface DigitArtViewProps {
  kind: ArtKind
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
  /** Neighbour mosaic only: columns (0 = fill the width), groups-only filter, sweep. */
  mosaic?: ViewOptions['mosaic']
  onMosaicChange?: (change: Partial<ViewOptions['mosaic']>) => void
  /** Show only groups of this free shape (picked in the shape census), or null. */
  shapeFilter?: string | null
  /** The mosaic's current column count (for the shape census). */
  onLayout?: (columns: number) => void
  /** Sunflower only: draw the Fibonacci spirals. */
  sunflower?: ViewOptions['sunflower']
  onSunflowerChange?: (change: Partial<ViewOptions['sunflower']>) => void
}

const GROUP_CHOICES = [0, 2, 3, 4, 5] as const
/** Sweep speeds offered, in columns per second. */
const SWEEP_SPEEDS = [
  { value: 0.5, label: 'Slow' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'Fast' },
] as const

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
  shapeFilter = null,
  sunflower,
  onSunflowerChange,
  onLayout,
}: DigitArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const definition = ART[kind]
  const number = useNumber()
  const renderer = useRef<DigitRenderer | null>(null)
  const [summary, setSummary] = useState('No digits yet.')
  const [shownColumns, setShownColumns] = useState(0)
  const shownRef = useRef(0)
  const columns = mosaic?.columns ?? 0
  const minGroup = mosaic?.minGroup ?? 0
  const sweep = kind === 'mosaic' && Boolean(mosaic?.sweep)
  const spirals = kind === 'sunflower' && Boolean(sunflower?.spirals)

  const speed = mosaic?.sweepSpeed ?? 1
  // The sweep goes from half to one-and-a-half times the chosen width (or, in Fit mode, the width
  // it had when the sweep started); the saved width itself never changes.
  const [fitBase, setFitBase] = useState(12)
  const base = columns || fitBase
  const low = Math.max(MIN_MOSAIC_COLUMNS, Math.round(base / 2))
  const high = Math.min(MAX_MOSAIC_COLUMNS, Math.max(low + 2, Math.round(base * 1.5)))
  const [swept, setSwept] = useState(base)
  const layoutColumns = columns
  const describe = (count: number) => {
    const cols = renderer.current?.columns?.()
    if (cols) {
      setShownColumns(cols)
      shownRef.current = cols
      onLayout?.(cols)
    }
    if (count === 0) return 'No digits yet.'
    if (spirals) {
      const pair = spiralNeighbours(count - 1)
      const families = pair
        ? ` At the edge, ${pair[0]} spirals turn one way and ${pair[1]} the other: consecutive Fibonacci numbers.`
        : ''
      return `${definition.summary(count, source.length)}${families}`
    }
    if (kind !== 'mosaic' || !cols) return definition.summary(count, source.length)
    const groups = shapeFilter
      ? ' Showing only one shape of group.'
      : minGroup > 1
        ? ` Showing only groups of ${minGroup} or more equal neighbours.`
        : ''
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

  // The sweep replaces this canvas with its own; turning it off mounts a fresh, empty canvas, so
  // the sweep state is part of the key and the picture is rebuilt (B-018).
  useDigitFeed(
    log,
    `${kind}:${source.id}:${size.width}x${size.height}:${colors.join()}:${layoutColumns}:${minGroup}:${shapeFilter}:${sweep}:${spirals}`,
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
          {
            mosaicColumns: layoutColumns || undefined,
            mosaicMinGroup: minGroup,
            mosaicShape: shapeFilter ?? undefined,
            sunflowerSpirals: spirals,
          },
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
      aria-label={`${withSymbol(definition.describe, number.symbol)} ${summary}`}
    />
  )
  if (kind === 'sunflower' && onSunflowerChange)
    return (
      <div className="viz-layer">
        {canvas}
        <label className="viz-toggle">
          <input
            type="checkbox"
            checked={spirals}
            onChange={(e) => onSunflowerChange({ spirals: e.target.checked })}
          />
          Spirals
        </label>
      </div>
    )
  if (kind !== 'mosaic' || !onMosaicChange) return canvas

  const fit = columns === 0
  const current = sweep ? swept : fit ? shownColumns || 10 : columns
  const set = (value: number) =>
    onMosaicChange({
      columns: Math.min(MAX_MOSAIC_COLUMNS, Math.max(MIN_MOSAIC_COLUMNS, Math.round(value))),
    })
  return (
    <div className="viz-layer viz-layer-with-bar">
      {sweep ? (
        <MosaicSweep
          source={source}
          log={log}
          low={low}
          high={high}
          speed={speed}
          minGroup={minGroup}
          shapeFilter={shapeFilter}
          onLayout={(cols) => {
            setSwept(cols)
            onLayout?.(cols)
          }}
          onCanvas={onCanvas}
        />
      ) : (
        canvas
      )}
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
            onChange={(e) => {
              if (e.target.checked) setFitBase(shownRef.current || 12)
              onMosaicChange({ sweep: e.target.checked })
            }}
          />
          Sweep
        </label>
        {sweep && (
          <label className="viz-columns-select">
            Speed
            <select
              value={speed}
              onChange={(e) => onMosaicChange({ sweepSpeed: Number(e.target.value) })}
            >
              {SWEEP_SPEEDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
