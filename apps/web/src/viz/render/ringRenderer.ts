import { polar, ringAngle, ringSegment, TransitionCounts } from '../art'
import { withAlpha } from '../palettes'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/** Live rebuilds replay at most this many of the latest links (posters draw everything). */
export const RING_MAX_REDRAW = 10_000

/**
 * Digit ring (after Cristian Ilies Vasile and Martin Krzywinski): ten coloured arcs and a gradient
 * ribbon from each digit to the next. The k-th occurrence of a digit sits at frac(k/φ) along its
 * arc, so links spread evenly and never move.
 */
export function createRingRenderer(
  { width, height, scale, colors }: RendererOptions,
  { maxRedraw = RING_MAX_REDRAW } = {},
): DigitRenderer {
  const layer = createLayer(width, height)
  const layerCtx = layer.getContext('2d')!
  const cx = width / 2
  const cy = height / 2
  const radius = Math.max(40 * scale, Math.min(width, height) / 2 - 64 * scale)
  const occurrences = new Uint32Array(10)
  const transitions = new TransitionCounts()
  let previous = -1
  let previousAngle = 0
  let lastLink: [number, number, number, number] | null = null

  const advance = (digit: number) => {
    const angle = ringAngle(digit, occurrences[digit]!++)
    if (previous >= 0) transitions.add(previous, digit)
    const link = previous >= 0 ? ([previousAngle, angle, previous] as const) : null
    previous = digit
    previousAngle = angle
    return link
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      const start = Math.max(from, to - maxRedraw)
      for (let i = from; i < start; i++) advance(digitAt(i)) // statistics only
      layerCtx.lineWidth = scale
      // Fade as the ring fills so the weave stays readable.
      const alphaAt = (i: number) => Math.max(0.05, Math.min(0.6, 4 / Math.sqrt(i + 10)))

      for (let i = start; i < to; i++) {
        const digit = digitAt(i)
        const link = advance(digit)
        if (!link) continue
        const [a1, a2, fromDigit] = link
        const [x1, y1] = polar(a1, radius)
        const [x2, y2] = polar(a2, radius)
        // A gradient per link: transparency accumulates where ribbons cross, which is what gives
        // the weave its depth (one batched path would paint overlaps only once).
        const gradient = layerCtx.createLinearGradient(cx + x1, cy + y1, cx + x2, cy + y2)
        gradient.addColorStop(0, withAlpha(colors[fromDigit]!, alphaAt(i)))
        gradient.addColorStop(1, withAlpha(colors[digit]!, alphaAt(i)))
        layerCtx.beginPath()
        layerCtx.moveTo(cx + x1, cy + y1)
        layerCtx.quadraticCurveTo(cx + (x1 + x2) * 0.15, cy + (y1 + y2) * 0.15, cx + x2, cy + y2)
        layerCtx.strokeStyle = gradient
        layerCtx.stroke()
        lastLink = [cx + x1, cy + y1, cx + x2, cy + y2]
      }
    },

    compose(ctx, { highlight, chordDigits }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      for (let d = 0; d < 10; d++) {
        const [start, end] = ringSegment(d)
        ctx.beginPath()
        ctx.arc(cx, cy, radius + 10 * scale, start, end)
        ctx.strokeStyle = colors[d]!
        ctx.lineWidth = (chordDigits?.has(d) ? 12 : 7) * scale
        ctx.lineCap = 'butt'
        ctx.stroke()
        const [lx, ly] = polar((start + end) / 2, radius + 30 * scale)
        ctx.fillStyle = '#c9d6e8'
        ctx.font = `${13 * scale}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(d), cx + lx, cy + ly)
      }
      if (transitions.max > 0) {
        for (let from = 0; from < 10; from++) {
          const [start, end] = ringSegment(from)
          for (let to = 0; to < 10; to++) {
            const count = transitions.get(from, to)
            if (!count) continue
            const [bx, by] = polar(start + ((to + 0.5) / 10) * (end - start), radius + 50 * scale)
            ctx.beginPath()
            ctx.arc(
              cx + bx,
              cy + by,
              Math.sqrt(count / transitions.max) * 5 * scale + 0.6,
              0,
              Math.PI * 2,
            )
            ctx.fillStyle = withAlpha(colors[to]!, 0.85)
            ctx.fill()
          }
        }
      }
      if (highlight && lastLink) {
        const [x1, y1, x2, y2] = lastLink
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.quadraticCurveTo(cx + (x1 + x2 - 2 * cx) * 0.15, cy + (y1 + y2 - 2 * cy) * 0.15, x2, y2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
      ctx.fillStyle = '#8fd3ff'
      ctx.font = `${Math.round(radius * 0.22)}px Georgia, serif`
      ctx.fillText('π', cx, cy)
    },
  }
}
