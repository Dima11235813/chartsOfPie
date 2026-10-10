import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog, PerformedNote } from '../../core/composition/performanceLog'
import { intervalName } from '../../core/music/chords'
import { harmonographPoints, intervalRatio } from '../../viz/harmonograph'
import { PHI } from '../../viz/art'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface HarmonographViewProps {
  /** Draw the nearest pure ratio instead of the equal-tempered one. */
  pure: boolean
  onPureChange: (pure: boolean) => void
  /** Draw the golden ratio φ : 1 instead of the interval being played. */
  golden?: boolean
  onGoldenChange?: (golden: boolean) => void
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
/** Redraw at most every this many ms (24 fps: smooth for a slow turn, half the raster work). */
const FRAME_MS = 1000 / 24 - 2
/** Stop turning this long after the last note. */
const IDLE_MS = 4000

const GOLDEN_CAPTION =
  'φ : 1 ≈ 1.618, an interval of 833 cents (between a minor and a major sixth). No whole-number ratio is close to φ, so the figure never closes.'

export function HarmonographView({
  log,
  pure,
  onPureChange,
  golden = false,
  onGoldenChange,
  onCanvas,
}: HarmonographViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [caption, setCaption] = useState('Press Play — each interval draws its own figure.')
  const pair = useRef<[PerformedNote, PerformedNote] | null>(null)
  /** When the last note arrived: the figure stops turning once playback goes quiet. */
  const lastNoteAt = useRef(0)

  useEffect(() => {
    const update = () => {
      lastNoteAt.current = performance.now()
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
    let lastDraw = -Infinity
    let lastPair: [PerformedNote, PerformedNote] | null = null
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      // 30 frames/s is plenty for a slow turn; when idle (paused for a while) and nothing changed,
      // skip the frame entirely — redrawing a ~2,000-point curve 60×/s was ~50 % of a core.
      const idle = reduced || now - lastNoteAt.current > IDLE_MS
      if (now - lastDraw < FRAME_MS) return
      if (idle && pair.current === lastPair && lastDraw > 0) return
      lastDraw = now
      lastPair = pair.current
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const current = pair.current
      if (current) {
        const [low, high] = current
        const { tempered, just } = intervalRatio(low.midi, high.midi)
        // φ is the "most irrational" ratio (its continued fraction is all 1s): no whole-number
        // ratio approximates it well, so its figure never closes and fills the frame as it turns.
        const ratio = golden ? PHI : pure ? just[0] / just[1] : tempered
        // A pure p:q figure closes after q periods: draw a few full cycles of it so pure ratios
        // retrace themselves crisply and tempered ones visibly drift.
        const turns = golden ? 28 : Math.min(28, Math.max(8, just[1] * 4))
        const points = harmonographPoints(ratio, phase, { turns, samples: turns * 64 })
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
      if (!idle) phase += 0.015 // per 24 fps frame: the same speed as 0.006 at 60 fps
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, size, colors, pure, golden])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={
          golden
            ? `Harmonograph (golden ratio): φ : 1 drawn as a Lissajous figure. ${GOLDEN_CAPTION}`
            : `Harmonograph${pure ? ' (pure ratios)' : ''}: the current interval drawn as a Lissajous figure. ${caption}`
        }
      />
      <p className="viz-caption">{golden ? GOLDEN_CAPTION : caption}</p>
      <span className="viz-toggles">
        <label className="viz-toggle">
          <input
            type="checkbox"
            checked={pure}
            disabled={golden}
            onChange={(e) => onPureChange(e.target.checked)}
          />
          Pure ratios
        </label>
        {onGoldenChange && (
          <label className="viz-toggle">
            <input
              type="checkbox"
              checked={golden}
              onChange={(e) => onGoldenChange(e.target.checked)}
            />
            Golden ratio
          </label>
        )}
      </span>
    </div>
  )
}
