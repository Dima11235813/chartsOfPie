import { useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { polar, ringAngle, ringSegment, TransitionCounts } from '../../viz/art'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { createLayer, useDigitFeed } from './useDigitFeed'

interface ArtViewProps {
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/** Rebuilding the picture redraws at most this many of the latest links. */
const MAX_REDRAW = 20_000

/**
 * Digit ring (after Cristian Ilies Vasile and Martin Krzywinski): ten coloured arcs, and a gradient
 * ribbon from each digit of π to the next. Bubbles outside each arc show how often each
 * digit → digit transition has occurred; chords that form by coincidence light up their digits.
 */
export function RingView({ source, log, onCanvas }: ArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [summary, setSummary] = useState('No digits yet.')
  const state = useRef({
    layer: null as HTMLCanvasElement | null,
    occurrences: new Uint32Array(10),
    transitions: new TransitionCounts(),
    previous: -1,
    previousAngle: 0,
    lastLink: null as [number, number, number, number] | null,
  })

  const geometry = () => {
    const canvas = canvasRef.current!
    const w = canvas.width
    const h = canvas.height
    // Leave room outside the ring for the arcs, labels and transition bubbles (≈ 58 CSS px).
    const radius = Math.max(40 * size.ratio, Math.min(w, h) / 2 - 64 * size.ratio)
    return { canvas, w, h, cx: w / 2, cy: h / 2, radius, ratio: size.ratio }
  }

  const compose = () => {
    const s = state.current
    const { canvas, w, h, cx, cy, radius, ratio } = geometry()
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    if (s.layer) ctx.drawImage(s.layer, 0, 0)

    // Arcs and labels
    const chord = log.chords.at(-1)
    const chordDigits =
      chord && log.lastStep && chord.index === log.lastStep.index
        ? new Set(chord.notes.map((n) => n.digit))
        : new Set<number>()
    for (let d = 0; d < 10; d++) {
      const [start, end] = ringSegment(d)
      ctx.beginPath()
      ctx.arc(cx, cy, radius + 10 * ratio, start, end)
      ctx.strokeStyle = colors[d]!
      ctx.lineWidth = (chordDigits.has(d) ? 12 : 7) * ratio
      ctx.lineCap = 'butt'
      ctx.stroke()
      const [lx, ly] = polar((start + end) / 2, radius + 30 * ratio)
      ctx.fillStyle = '#c9d6e8'
      ctx.font = `${13 * ratio}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(d), cx + lx, cy + ly)
    }

    // Transition bubbles: for each "from" arc, one bubble per "to" digit
    const { transitions } = s
    if (transitions.max > 0) {
      for (let from = 0; from < 10; from++) {
        const [start, end] = ringSegment(from)
        for (let to = 0; to < 10; to++) {
          const count = transitions.get(from, to)
          if (!count) continue
          const angle = start + ((to + 0.5) / 10) * (end - start)
          const [bx, by] = polar(angle, radius + 50 * ratio)
          ctx.beginPath()
          ctx.arc(
            cx + bx,
            cy + by,
            Math.sqrt(count / transitions.max) * 5 * ratio + 0.6,
            0,
            Math.PI * 2,
          )
          ctx.fillStyle = withAlpha(colors[to]!, 0.85)
          ctx.fill()
        }
      }
    }

    // The newest link, bright
    if (s.lastLink) {
      const [x1, y1, x2, y2] = s.lastLink
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.quadraticCurveTo(cx + (x1 + x2 - 2 * cx) * 0.15, cy + (y1 + y2 - 2 * cy) * 0.15, x2, y2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 1.5 * ratio
      ctx.stroke()
    }

    ctx.fillStyle = '#8fd3ff'
    ctx.font = `${Math.round(radius * 0.22)}px Georgia, serif`
    ctx.fillText('π', cx, cy)
  }

  const addLink = (
    ctx: CanvasRenderingContext2D,
    digit: number,
    alpha: number,
    highlight: boolean,
  ) => {
    const s = state.current
    const { cx, cy, radius, ratio } = geometry()
    const angle = ringAngle(digit, s.occurrences[digit]!++)
    if (s.previous >= 0) {
      s.transitions.add(s.previous, digit)
      const [x1, y1] = polar(s.previousAngle, radius)
      const [x2, y2] = polar(angle, radius)
      const gradient = ctx.createLinearGradient(cx + x1, cy + y1, cx + x2, cy + y2)
      gradient.addColorStop(0, withAlpha(colors[s.previous]!, alpha))
      gradient.addColorStop(1, withAlpha(colors[digit]!, alpha))
      ctx.beginPath()
      ctx.moveTo(cx + x1, cy + y1)
      ctx.quadraticCurveTo(cx + (x1 + x2) * 0.15, cy + (y1 + y2) * 0.15, cx + x2, cy + y2)
      ctx.strokeStyle = gradient
      ctx.lineWidth = ratio
      ctx.stroke()
      if (highlight) s.lastLink = [cx + x1, cy + y1, cx + x2, cy + y2]
    }
    s.previous = digit
    s.previousAngle = angle
  }

  useDigitFeed(log, `${size.width}x${size.height}:${colors.join()}`, {
    reset() {
      const s = state.current
      if (!canvasRef.current || size.width === 0) return
      s.layer = createLayer(canvasRef.current)
      s.occurrences.fill(0)
      s.transitions.reset()
      s.previous = -1
      s.lastLink = null
      compose()
      setSummary('No digits yet.')
    },
    draw(from, to) {
      const s = state.current
      if (!s.layer) return
      const ctx = s.layer.getContext('2d')!
      const start = Math.max(from, to - MAX_REDRAW)
      if (start > from) {
        // Only replay the tail, but keep the transition statistics exact.
        for (let i = from; i < start; i++) {
          const digit = source.digitAt(i)
          if (s.previous >= 0) s.transitions.add(s.previous, digit)
          s.occurrences[digit]!++
          s.previous = digit
          s.previousAngle = ringAngle(digit, s.occurrences[digit]! - 1)
        }
      }
      for (let i = start; i < to; i++) {
        // Fade links as the ring fills so the weave stays visible.
        const alpha = Math.max(0.05, Math.min(0.6, 4 / Math.sqrt(i + 10)))
        addLink(ctx, source.digitAt(i), alpha, i === to - 1)
      }
      compose()
      setSummary(`${to.toLocaleString()} digits woven between the ten digit arcs.`)
    },
  })

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`Digit ring: each digit of π is linked to the next around a circle of ten coloured arcs. ${summary}`}
    />
  )
}
