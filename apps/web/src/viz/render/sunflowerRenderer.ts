import { seedPosition, sunflowerCapacity } from '../art'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/**
 * Sunflower: digit n is a seed at radius ∝ √n, turned n × the golden angle (Vogel's model). The
 * disc is laid out for a capacity of 400 × 4ᵏ seeds; it is rebuilt only when that grows.
 */
export function createSunflowerRenderer(
  { width, height, scale, colors }: RendererOptions,
  { capacity: fixedCapacity }: { capacity?: number } = {},
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
    const dot = step * 0.62
    const round = dot > 1.5
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
