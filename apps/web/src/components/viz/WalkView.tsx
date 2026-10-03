import { useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { fitBounds, WalkPath, type FitTransform } from '../../viz/art'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { createLayer, useDigitFeed } from './useDigitFeed'

interface ArtViewProps {
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/**
 * π walk (after Nadieh Bremer's "The Art in Pi"): every digit is one step in one of ten directions
 * (0 = up, clockwise in 36° turns). The view zooms out as the walk wanders, so 100 digits and
 * 100,000 digits both fill the frame.
 */
export function WalkView({ source, log, onCanvas }: ArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [summary, setSummary] = useState('No digits yet.')
  const state = useRef({
    layer: null as HTMLCanvasElement | null,
    walk: new WalkPath(),
    digits: [] as number[],
    fit: null as FitTransform | null,
  })

  const toScreen = (fit: FitTransform, x: number, y: number): [number, number] => [
    fit.offsetX + x * fit.scale,
    fit.offsetY + y * fit.scale,
  ]

  /** Draw segments [from, to) of the walk onto the layer. */
  const drawSegments = (from: number, to: number) => {
    const s = state.current
    if (!s.layer || !s.fit) return
    const ctx = s.layer.getContext('2d')!
    ctx.lineWidth = Math.max(0.6, Math.min(2.5, s.fit.scale * 0.35)) * size.ratio
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // One path per digit colour keeps tens of thousands of segments fast.
    for (let d = 0; d < 10; d++) {
      ctx.beginPath()
      let any = false
      for (let i = from; i < to; i++) {
        if (s.digits[i] !== d) continue
        const [x1, y1] = toScreen(s.fit, s.walk.xs[i]!, s.walk.ys[i]!)
        const [x2, y2] = toScreen(s.fit, s.walk.xs[i + 1]!, s.walk.ys[i + 1]!)
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        any = true
      }
      if (any) {
        ctx.strokeStyle = withAlpha(colors[d]!, 0.75)
        ctx.stroke()
      }
    }
  }

  const refit = () => {
    const s = state.current
    const canvas = canvasRef.current!
    const { walk } = s
    s.fit = fitBounds(walk.minX, walk.maxX, walk.minY, walk.maxY, canvas.width, canvas.height, 1.6)
    s.layer = createLayer(canvas)
    drawSegments(0, s.digits.length)
  }

  const fits = () => {
    const s = state.current
    const canvas = canvasRef.current!
    if (!s.fit) return false
    const pad = 12 * size.ratio
    const [x1, y1] = toScreen(s.fit, s.walk.minX, s.walk.minY)
    const [x2, y2] = toScreen(s.fit, s.walk.maxX, s.walk.maxY)
    return x1 >= pad && y1 >= pad && x2 <= canvas.width - pad && y2 <= canvas.height - pad
  }

  const compose = () => {
    const s = state.current
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (s.layer) ctx.drawImage(s.layer, 0, 0)
    if (!s.fit) return
    const r = 4 * size.ratio
    const [sx, sy] = toScreen(s.fit, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(sx, sy, r * 0.7, 0, Math.PI * 2)
    ctx.fill()
    const last = s.walk.length - 1
    const [ex, ey] = toScreen(s.fit, s.walk.xs[last]!, s.walk.ys[last]!)
    ctx.beginPath()
    ctx.arc(ex, ey, r * 1.6, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5 * size.ratio
    ctx.stroke()
  }

  useDigitFeed(log, `${size.width}x${size.height}:${colors.join()}`, {
    reset() {
      const s = state.current
      if (!canvasRef.current || size.width === 0) return
      s.walk = new WalkPath()
      s.digits = []
      refit()
      compose()
      setSummary('No digits yet.')
    },
    draw(from, to) {
      const s = state.current
      if (!canvasRef.current || !s.fit) return
      for (let i = from; i < to; i++) {
        const digit = source.digitAt(i)
        s.digits.push(digit)
        s.walk.push(digit)
      }
      if (fits()) drawSegments(from, to)
      else refit()
      compose()
      const reach = Math.hypot(s.walk.xs[s.walk.length - 1]!, s.walk.ys[s.walk.length - 1]!)
      setSummary(`${to.toLocaleString()} steps; now ${reach.toFixed(0)} steps from the start.`)
    },
  })

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`π walk: each digit is a step in one of ten directions. ${summary}`}
    />
  )
}
