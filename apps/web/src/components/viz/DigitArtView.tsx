import { useRef, useState } from 'react'
import { MAX_MOSAIC_COLUMNS, MIN_MOSAIC_COLUMNS } from '../../core/piece/visualConfig'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { ART, type ArtKind } from '../../viz/render/registry'
import type { DigitRenderer } from '../../viz/render/renderer'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { useDigitFeed } from './useDigitFeed'

interface DigitArtViewProps {
  kind: ArtKind
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
  /** Neighbour mosaic only: fixed column count, 0 = fill the width. */
  columns?: number
  onColumnsChange?: (columns: number) => void
}

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
  columns = 0,
  onColumnsChange,
}: DigitArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const definition = ART[kind]
  const renderer = useRef<DigitRenderer | null>(null)
  const [summary, setSummary] = useState('No digits yet.')
  const [shownColumns, setShownColumns] = useState(0)
  const describe = (count: number) => {
    const cols = renderer.current?.columns?.()
    if (cols) setShownColumns(cols)
    if (count === 0) return 'No digits yet.'
    if (kind !== 'mosaic' || !cols) return definition.summary(count)
    return `${count.toLocaleString()} digits in ${cols} columns. A vertical link joins equal digits ${cols} places apart; a diagonal one, ${cols - 1} or ${cols + 1} apart.`
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

  useDigitFeed(log, `${kind}:${size.width}x${size.height}:${colors.join()}:${columns}`, {
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
        { mosaicColumns: columns || undefined },
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
  })

  const canvas = (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`${definition.describe} ${summary}`}
    />
  )
  if (kind !== 'mosaic' || !onColumnsChange) return canvas

  const fit = columns === 0
  const current = fit ? shownColumns || 10 : columns
  const set = (value: number) =>
    onColumnsChange(Math.min(MAX_MOSAIC_COLUMNS, Math.max(MIN_MOSAIC_COLUMNS, Math.round(value))))
  return (
    <div className="viz-layer viz-layer-with-bar">
      {canvas}
      <div className="viz-columns" role="group" aria-label="Mosaic width">
        <label className="viz-columns-fit">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => (e.target.checked ? onColumnsChange(0) : set(current))}
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
        <output className="viz-columns-count" aria-live="polite">
          {current} columns
        </output>
      </div>
    </div>
  )
}
