import { hilbertPoint, hilbertSide } from '../art'
import { parseColor } from '../palettes'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

const GHOST_BRIGHTNESS = 0.22
const MIN_WINDOW = 32

/**
 * Hilbert carpet: digits laid along a Hilbert curve, one pixel each, so neighbours in π stay
 * neighbours in the picture. 1024² = 1,048,576 cells hold the whole million. Live, the full carpet
 * is drawn faintly (the "ghost") and each digit lights up as it plays.
 */
export function createHilbertRenderer(
  { width, height, scale, colors, ghost }: RendererOptions,
  { side: fixedSide }: { side?: number } = {},
): DigitRenderer {
  const side = fixedSide ?? hilbertSide(ghost?.count ?? 1_000_001)
  const image = new ImageData(side, side)
  const rgb: [number, number, number][] = colors.map((c) => parseColor(c) ?? [255, 255, 255])
  const pixels = createLayer(side, side)
  const pixelCtx = pixels.getContext('2d')!
  let count = 0
  /** Extent of the lit (played) cells, for cropping posters to what was drawn. */
  let litW = 1
  let litH = 1
  let dirty: [number, number, number, number] | null = null

  const paint = (i: number, digit: number, brightness: number) => {
    const [x, y] = hilbertPoint(side, i)
    const offset = (y * side + x) * 4
    const [r, g, b] = rgb[digit]!
    image.data[offset] = r * brightness
    image.data[offset + 1] = g * brightness
    image.data[offset + 2] = b * brightness
    image.data[offset + 3] = 255
    dirty = dirty
      ? [Math.min(dirty[0], x), Math.min(dirty[1], y), Math.max(dirty[2], x), Math.max(dirty[3], y)]
      : [x, y, x, y]
  }

  if (ghost) {
    const total = Math.min(ghost.count, side * side)
    for (let i = 0; i < total; i++) paint(i, ghost.digitAt(i), GHOST_BRIGHTNESS)
  }

  const flush = () => {
    if (!dirty) return
    const [x0, y0, x1, y1] = dirty
    pixelCtx.putImageData(image, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
    dirty = null
  }

  // Fit the square carpet into the frame, keeping pixels crisp.
  const size = Math.min(width, height) - 16 * scale
  const left = (width - size) / 2
  const top = (height - size) / 2
  /**
   * Live zoom: the first 4ᵏ cells of a Hilbert curve always fill the corner square of side 2ᵏ, so
   * show only the square being filled (from 32 × 32 big pixels), zooming out 2× each time it fills.
   * Posters (no ghost) show the whole grid.
   */
  const windowSide = () =>
    ghost ? Math.min(side, Math.max(MIN_WINDOW, hilbertSide(count + 1))) : side

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      for (let i = from; i < Math.min(to, side * side); i++) {
        paint(i, digitAt(i), 1)
        const [x, y] = hilbertPoint(side, i)
        litW = Math.max(litW, x + 1)
        litH = Math.max(litH, y + 1)
      }
      count = to
    },

    compose(ctx, { highlight }) {
      flush()
      ctx.clearRect(0, 0, width, height)
      ctx.imageSmoothingEnabled = false
      if (!ghost) {
        // Poster: crop to the lit area (Hilbert prefixes fill rectangles) and centre it.
        const fit = Math.min((width - 16 * scale) / litW, (height - 16 * scale) / litH)
        const w = litW * fit
        const h = litH * fit
        ctx.drawImage(pixels, 0, 0, litW, litH, (width - w) / 2, (height - h) / 2, w, h)
        return
      }
      const win = windowSide()
      const cell = size / win
      ctx.drawImage(pixels, 0, 0, win, win, left, top, size, size)
      if (highlight && count > 0 && count <= side * side) {
        const [x, y] = hilbertPoint(side, count - 1)
        const cx = left + (x + 0.5) * cell
        const cy = top + (y + 0.5) * cell
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(6 * scale, cell * 0.9), 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
    },
  }
}
