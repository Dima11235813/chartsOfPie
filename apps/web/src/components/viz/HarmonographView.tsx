import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog, PerformedNote } from '../../core/composition/performanceLog'
import { intervalName } from '../../core/music/chords'
import { harmonographPoints, intervalRatio } from '../../viz/harmonograph'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface HarmonographViewProps {
  /** Draw the nearest pure ratio instead of the equal-tempered one. */
  pure: boolean
  onPureChange: (pure: boolean) => void
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/** The interval to draw: two notes sounding together, else the last two notes of the melody. */
function currentPair(log: PerformanceLog): [PerformedNote, PerformedNote] | null {
  const sounding = [...log.soundingAt(log.lastOnsetSec)].sort((a, b) => a.midi - b.midi)
  const distinct = sounding.filter((n, i) => i === 0 || n.midi !== sounding[i - 1]!.midi)
  if (distinct.length >= 2) return [distinct[0]!, distinct[1]!]
  const [a, b] = log.notes.slice(-2)
  if (!a || !b) return null
  return a.midi <= b.midi ? [a, b] : [b, a]
}

/**
 * Harmonograph: the current interval as a Lissajous figure — one note drives x, the other y. Pure
 * whole-number ratios (3:2, 5:4) trace thin closed curves: consonance you can see. Equal-tempered
 * intervals are a few cents off those ratios, so their figures never quite close and slowly turn.
 * The toggle swaps in the pure ratio to compare.
 */
export function HarmonographView({ log, pure, onPureChange, onCanvas }: HarmonographViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [caption, setCaption] = useState('Press Play — each interval draws its own figure.')
  const pair = useRef<[PerformedNote, PerformedNote] | null>(null)

  useEffect(() => {
    const update = () => {
      const next = currentPair(log)
      const previous = pair.current
      pair.current = next
      if (!next) return
      if (previous && previous[0].midi === next[0].midi && previous[1].midi === next[1].midi) return
      const [low, high] = next
      const { tempered, just, cents } = intervalRatio(low.midi, high.midi)
      setCaption(
        `${low.note} + ${high.note} · ${intervalName(low.midi, high.midi)} · ratio ${tempered.toFixed(4)} ≈ ${just[0]}:${just[1]} (${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents)`,
      )
    }
    update()
    return log.subscribe(update)
  }, [log])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const scale = size.ratio
    const reduced = prefersReducedMotion()
    let phase = 0
    let frame = 0
    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const current = pair.current
      if (current) {
        const [low, high] = current
        const { tempered, just } = intervalRatio(low.midi, high.midi)
        const ratio = pure ? just[0] / just[1] : tempered
        // A pure p:q figure closes after q periods: draw a few full cycles of it so pure ratios
        // retrace themselves crisply and tempered ones visibly drift.
        const turns = Math.min(40, Math.max(8, just[1] * 4))
        const points = harmonographPoints(ratio, phase, { turns, samples: turns * 120 })
        const radius = Math.min(w, h) * 0.42
        const cx = w / 2
        const cy = h / 2
        const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy)
        gradient.addColorStop(0, withAlpha(colors[low.digit]!, 0.9))
        gradient.addColorStop(1, withAlpha(colors[high.digit]!, 0.9))
        ctx.beginPath()
        for (let i = 0; i < points.length; i += 2) {
          const x = cx + points[i]! * radius
          const y = cy - points[i + 1]! * radius
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.2 * scale
        ctx.stroke()
      }
      if (!reduced) phase += 0.006
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, size, colors, pure])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={`Harmonograph${pure ? ' (pure ratios)' : ''}: the current interval drawn as a Lissajous figure. ${caption}`}
      />
      <p className="viz-caption">{caption}</p>
      <label className="viz-toggle">
        <input type="checkbox" checked={pure} onChange={(e) => onPureChange(e.target.checked)} />
        Pure ratios
      </label>
    </div>
  )
}
