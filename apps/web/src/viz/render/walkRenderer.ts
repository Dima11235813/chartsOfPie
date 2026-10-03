import { fitBounds, WalkPath, type FitTransform } from '../art'
import { paletteRamp, withAlpha } from '../palettes'

const POSITION_BANDS = 60
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/**
 * π walk (after Nadieh Bremer's "The Art in Pi"): each digit is a step in one of ten directions.
 * Refits (zooms out, redrawing the whole path) only when the walk leaves the frame.
 */
export function createWalkRenderer(
  { width, height, scale, colors }: RendererOptions,
  {
    positionTotal,
  }: {
    /**
     * Colour by position along the walk instead of by digit, sweeping through the palette from the
     * first step to step `positionTotal` (posters: a million overlapping segments would otherwise
     * be dominated by whichever digit colour is drawn last).
     */
    positionTotal?: number
  } = {},
): DigitRenderer {
  const bands = positionTotal ? paletteRamp(colors, POSITION_BANDS) : null
  let layer = createLayer(width, height)
  const walk = new WalkPath()
  const digits: number[] = []
  let fit: FitTransform = fitBounds(0, 0, 0, 0, width, height, 1.6)

  const toScreen = (x: number, y: number): [number, number] => [
    fit.offsetX + x * fit.scale,
    fit.offsetY + y * fit.scale,
  ]

  const drawSegments = (from: number, to: number) => {
    const ctx = layer.getContext('2d')!
    ctx.lineWidth = Math.max(0.6, Math.min(2.5, fit.scale * 0.35)) * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (bands && positionTotal) {
      // Bands in time order, so later steps are drawn over earlier ones.
      const perBand = positionTotal / bands.length
      for (let b = Math.floor(from / perBand); b < bands.length; b++) {
        const bandFrom = Math.max(from, Math.floor(b * perBand))
        const bandTo = Math.min(to, Math.floor((b + 1) * perBand))
        if (bandFrom >= bandTo) break
        ctx.beginPath()
        for (let i = bandFrom; i < bandTo; i++) {
          const [x1, y1] = toScreen(walk.xs[i]!, walk.ys[i]!)
          const [x2, y2] = toScreen(walk.xs[i + 1]!, walk.ys[i + 1]!)
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
        }
        ctx.strokeStyle = withAlpha(bands[b]!, 0.8)
        ctx.stroke()
      }
      return
    }
    // One path per digit colour keeps hundreds of thousands of segments fast.
    for (let d = 0; d < 10; d++) {
      ctx.beginPath()
      let any = false
      for (let i = from; i < to; i++) {
        if (digits[i] !== d) continue
        const [x1, y1] = toScreen(walk.xs[i]!, walk.ys[i]!)
        const [x2, y2] = toScreen(walk.xs[i + 1]!, walk.ys[i + 1]!)
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

  const fits = () => {
    const pad = 12 * scale
    const [x1, y1] = toScreen(walk.minX, walk.minY)
    const [x2, y2] = toScreen(walk.maxX, walk.maxY)
    return x1 >= pad && y1 >= pad && x2 <= width - pad && y2 <= height - pad
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      for (let i = from; i < to; i++) {
        const digit = digitAt(i)
        digits.push(digit)
        walk.push(digit)
      }
      if (fits()) {
        drawSegments(from, to)
      } else {
        fit = fitBounds(walk.minX, walk.maxX, walk.minY, walk.maxY, width, height, 1.6)
        layer = createLayer(width, height)
        drawSegments(0, digits.length)
      }
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      const r = 4 * scale
      const [sx, sy] = toScreen(0, 0)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(sx, sy, r * 0.7, 0, Math.PI * 2)
      ctx.fill()
      if (highlight && digits.length > 0) {
        const last = walk.length - 1
        const [ex, ey] = toScreen(walk.xs[last]!, walk.ys[last]!)
        ctx.beginPath()
        ctx.arc(ex, ey, r * 1.6, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
    },
  }
}

/** Steps between the walk's start and its current position (for summaries). */
export const walkReach = (walk: WalkPath) =>
  Math.hypot(walk.xs[walk.length - 1]!, walk.ys[walk.length - 1]!)
