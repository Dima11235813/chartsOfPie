import { seedPosition, spiralNeighbours, SPIRAL_OFFSETS, sunflowerCapacity } from '../art'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/** The two spiral families: offsets at even and odd places in the Fibonacci sequence. */
const SPIRAL_COLORS = ['rgba(245, 197, 66, 0.85)', 'rgba(150, 200, 255, 0.75)'] as const

/**
 * Sunflower: digit n is a seed at radius ∝ √n, turned n × the golden angle (Vogel's model). The
 * disc is laid out for a capacity of 400 × 4ᵏ seeds; it is rebuilt only when that grows. With
 * `spirals`, every seed is joined to its two nearest earlier seeds, always a Fibonacci number of
 * steps back (`spiralNeighbours`), which draws the clockwise and anticlockwise spirals.
 */
export function createSunflowerRenderer(
  { width, height, scale, colors }: RendererOptions,
  { capacity: fixedCapacity, spirals = false }: { capacity?: number; spirals?: boolean } = {},
): DigitRenderer {
  let layer = createLayer(width, height)
  let capacity = fixedCapacity ?? sunflowerCapacity(1)
  let count = 0
  let source: DigitAt | null = null
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.46
  const spacing = () => radius / Math.sqrt(capacity)

  const drawSeeds = (from: number, to: number, digitAt: DigitAt) => {
    const ctx = layer.getContext('2d')!
    const step = spacing()
    // With the spirals drawn, smaller seeds let the two families of curves show between them.
    const dot = step * (spirals ? 0.36 : 0.62)
    const round = dot > 1.5
    if (spirals) {
      // Spirals under this batch's seeds: one path per family.
      ctx.lineWidth = Math.max(0.8 * scale, step * 0.22)
      ctx.lineCap = 'round'
      const paths = [new Path2D(), new Path2D()]
      for (let n = Math.max(1, from); n < to; n++) {
        const pair = spiralNeighbours(n)
        if (!pair) continue
        const [x, y] = seedPosition(n, step)
        for (const offset of pair) {
          const [px, py] = seedPosition(n - offset, step)
          const path = paths[SPIRAL_OFFSETS.indexOf(offset) % 2]!
          path.moveTo(cx + px, cy + py)
          path.lineTo(cx + x, cy + y)
        }
      }
      paths.forEach((path, family) => {
        ctx.strokeStyle = SPIRAL_COLORS[family]!
        ctx.stroke(path)
      })
    }
    for (let n = from; n < to; n++) {
      const [x, y] = seedPosition(n, step)
      ctx.fillStyle = colors[digitAt(n)]!
      if (round) {
        ctx.beginPath()
        ctx.arc(cx + x, cy + y, dot, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(cx + x - dot, cy + y - dot, dot * 2, dot * 2)
      }
    }
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      source = digitAt
      count = to
      if (to > capacity) {
        capacity = sunflowerCapacity(to)
        layer = createLayer(width, height)
        drawSeeds(0, to, digitAt)
      } else {
        drawSeeds(from, to, digitAt)
      }
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      if (highlight && count > 0 && source) {
        const step = spacing()
        const [x, y] = seedPosition(count - 1, step)
        ctx.beginPath()
        ctx.arc(cx + x, cy + y, Math.max(step * 0.62 * 2.2, 4 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
    },
  }
}
