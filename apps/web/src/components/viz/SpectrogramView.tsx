import { useEffect, useMemo, useRef } from 'react'
import type { FrequencySource } from '../../audio/notePlayer'
import {
  colorFor,
  dbToUnit,
  DEFAULT_RANGE,
  frequencyRow,
  logFrequencyRows,
  spectrumColumn,
} from '../../viz/spectrogram'
import { useCanvas } from './useCanvas'

interface SpectrogramViewProps {
  /** Live analyser, or null before audio has started. */
  analyser: FrequencySource | null
  isPlaying: boolean
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const COLUMN_PX = 2
/** Keep scrolling this long after pause so release tails and reverb stay visible. */
const TAIL_MS = 3000
const LABELS = [50, 100, 200, 500, 1000, 2000, 5000]

/**
 * Live scrolling spectrogram of exactly what is being heard (taps the final mix). Time runs right
 * to left, frequency is logarithmic (like a piano keyboard), brightness is loudness.
 */
export function SpectrogramView({ analyser, isPlaying, onCanvas }: SpectrogramViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const stopAt = useRef(0)

  useEffect(() => {
    stopAt.current = isPlaying ? Infinity : performance.now() + TAIL_MS
  }, [isPlaying])

  const rows = useMemo(() => {
    if (!analyser || size.height === 0) return null
    return logFrequencyRows(
      Math.round(size.height * size.ratio),
      analyser.frequencyBinCount,
      analyser.sampleRate,
    )
  }, [analyser, size])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = `rgb(${colorFor(0).join(',')})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!analyser || !rows) return

    const spectrum = new Float32Array(analyser.frequencyBinCount)
    const columnWidth = Math.round(COLUMN_PX * size.ratio)
    const column = ctx.createImageData(columnWidth, canvas.height)
    let frame = 0

    const draw = () => {
      if (performance.now() < stopAt.current) {
        analyser.getFloatFrequencyData(spectrum)
        const levels = spectrumColumn(spectrum, rows)
        for (let y = 0; y < canvas.height; y++) {
          const [r, g, b] = colorFor(dbToUnit(levels[y]!, DEFAULT_RANGE))
          for (let x = 0; x < columnWidth; x++) {
            const offset = (y * columnWidth + x) * 4
            column.data[offset] = r
            column.data[offset + 1] = g
            column.data[offset + 2] = b
            column.data[offset + 3] = 255
          }
        }
        ctx.drawImage(canvas, -columnWidth, 0)
        ctx.putImageData(column, canvas.width - columnWidth, 0)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [analyser, rows, canvasRef, size])

  return (
    <div className="spectrogram">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label="Live spectrogram: time runs right to left, pitch goes up, brightness shows loudness."
      />
      {size.height > 0 && (
        <ol className="spectrogram-axis" aria-hidden="true">
          {LABELS.map((hz) => (
            <li
              key={hz}
              style={{
                top: `${(frequencyRow(hz, size.height, DEFAULT_RANGE) / size.height) * 100}%`,
              }}
            >
              {hz >= 1000 ? `${hz / 1000}k` : hz}
            </li>
          ))}
        </ol>
      )}
      {!analyser && <p className="viz-placeholder">Press Play to see the sound.</p>}
    </div>
  )
}
