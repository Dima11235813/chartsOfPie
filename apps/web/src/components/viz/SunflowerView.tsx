import { useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { seedPosition, sunflowerCapacity } from '../../viz/art'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { createLayer, useDigitFeed } from './useDigitFeed'

interface ArtViewProps {
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/**
 * Sunflower: digit n of π is a seed at radius ∝ √n, turned n × the golden angle (Vogel's model of
 * a sunflower head). The digits fill the disc evenly, so any clustering would show — and none does.
 */
export function SunflowerView({ source, log, onCanvas }: ArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [summary, setSummary] = useState('No seeds yet.')
  const state = useRef({
    layer: null as HTMLCanvasElement | null,
    capacity: 0,
    count: 0,
  })

  const layout = () => {
    const canvas = canvasRef.current!
    const radius = Math.min(canvas.width, canvas.height) * 0.46
    const spacing = radius / Math.sqrt(state.current.capacity)
    return { canvas, cx: canvas.width / 2, cy: canvas.height / 2, spacing, dot: spacing * 0.62 }
  }

  const drawSeeds = (from: number, to: number) => {
    const s = state.current
    if (!s.layer) return
    const ctx = s.layer.getContext('2d')!
    const { cx, cy, spacing, dot } = layout()
    const round = dot > 1.5
    for (let n = from; n < to; n++) {
      const [x, y] = seedPosition(n, spacing)
      ctx.fillStyle = colors[source.digitAt(n)]!
      if (round) {
        ctx.beginPath()
        ctx.arc(cx + x, cy + y, dot, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(cx + x - dot, cy + y - dot, dot * 2, dot * 2)
      }
    }
  }

  const compose = () => {
    const s = state.current
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (s.layer) ctx.drawImage(s.layer, 0, 0)
    if (s.count > 0) {
      const { cx, cy, spacing, dot } = layout()
      const [x, y] = seedPosition(s.count - 1, spacing)
      ctx.beginPath()
      ctx.arc(cx + x, cy + y, Math.max(dot * 2.2, 4 * size.ratio), 0, Math.PI * 2)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5 * size.ratio
      ctx.stroke()
    }
  }

  const rebuild = (count: number) => {
    const s = state.current
    s.capacity = sunflowerCapacity(Math.max(1, count))
    s.layer = createLayer(canvasRef.current!)
    drawSeeds(0, count)
  }

  useDigitFeed(log, `${size.width}x${size.height}:${colors.join()}`, {
    reset() {
      if (!canvasRef.current || size.width === 0) return
      state.current.count = 0
      rebuild(0)
      compose()
      setSummary('No seeds yet.')
    },
    draw(from, to) {
      const s = state.current
      if (!canvasRef.current || !s.layer) return
      s.count = to
      if (to > s.capacity) rebuild(to)
      else drawSeeds(from, to)
      compose()
      setSummary(`${to.toLocaleString()} seeds, one per digit, on a golden-angle spiral.`)
    },
  })

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`Sunflower: digits of π as seeds on a golden-angle spiral. ${summary}`}
    />
  )
}
