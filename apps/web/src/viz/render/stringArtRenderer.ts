import { circlePointAngle, polar, stringArtTarget } from '../art'
import { withAlpha } from '../palettes'

export const STRING_ART_POINTS = 240

export interface StringArtFrame {
  multiplier: number
  colors: readonly string[]
  /** Brighten everything briefly (e.g. when a chord forms). */
  glow?: number
  /** Show "×k mod N" in the corner. */
  label?: boolean
}

/**
 * Times-table string art: N points on a circle, a string from each point n to k·n mod N. The
 * multiplier k comes from the latest two digits and the live view eases towards it, so cardioids,
 * nephroids and their cousins morph into one another as π plays (Mathologer's "times tables").
 */
export function drawStringArt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  { multiplier, colors, glow = 0, label = true }: StringArtFrame,
  points = STRING_ART_POINTS,
): void {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.44
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = Math.max(0.6, scale * 0.9)
  const alpha = Math.min(1, 0.55 + glow * 0.45)
  // Batch strings by colour (the digit n mod 10) for speed.
  for (let d = 0; d < 10; d++) {
    ctx.beginPath()
    for (let n = d; n < points; n += 10) {
      const [x1, y1] = polar(circlePointAngle(n, points), radius)
      const [x2, y2] = polar(
        circlePointAngle(stringArtTarget(n, multiplier, points), points),
        radius,
      )
      ctx.moveTo(cx + x1, cy + y1)
      ctx.lineTo(cx + x2, cy + y2)
    }
    ctx.strokeStyle = withAlpha(colors[d]!, alpha)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(201, 214, 232, 0.35)'
  ctx.lineWidth = scale
  ctx.stroke()
  if (label) {
    ctx.fillStyle = '#c9d6e8'
    ctx.font = `${14 * scale}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`n → ${multiplier.toFixed(2)} × n  (mod ${points})`, 12 * scale, 12 * scale)
  }
}
