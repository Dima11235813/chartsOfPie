import { goldenCell, goldenLayout, goldenSquaresFor, type GoldenLayout } from '../golden'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

const SPIRAL_COLOR = 'rgba(245, 197, 66, 0.95)'
const SQUARE_COLOR = 'rgba(201, 214, 232, 0.45)'

/**
 * Golden rectangle: digits fill the Fibonacci squares 1, 1, 2, 3, 5, 8… from the centre outwards
 * (viz/golden.ts), with the squares outlined and the golden spiral drawn through the ones reached
 * so far. Live, the rectangle holds the fewest squares the digits need and is rebuilt (one more
 * square, ≈ φ² times the cells) when they outgrow it; turned to match the frame's orientation.
 */
export function createGoldenRenderer(
  { width, height, scale, colors }: RendererOptions,
  { count: fixedCount, spiral = true }: { count?: number; spiral?: boolean } = {},
): DigitRenderer {
  const pad = 12 * scale
  let layer = createLayer(width, height)
  let layout: GoldenLayout
  let cell = 1
  let left = 0
  let top = 0
  let transposed = false
  let count = 0

  const fit = (squares: number) => {
    layout = goldenLayout(squares)
    // Long side along the frame's long side (a mirror image is still a golden rectangle).
    transposed = layout.width > layout.height !== width >= height
    const w = transposed ? layout.height : layout.width
    const h = transposed ? layout.width : layout.height
    cell = Math.min((width - pad * 2) / w, (height - pad * 2) / h)
    left = (width - w * cell) / 2
    top = (height - h * cell) / 2
  }
  /** Pixel position of a grid point (cell corner) of the layout. */
  const toScreen = (x: number, y: number): [number, number] => {
    const gx = x - layout.minX
    const gy = y - layout.minY
    return transposed ? [left + gy * cell, top + gx * cell] : [left + gx * cell, top + gy * cell]
  }
  fit(goldenSquaresFor(fixedCount ?? 1))

  const drawCells = (from: number, to: number, digitAt: DigitAt) => {
    const ctx = layer.getContext('2d')!
    const inset = cell >= 4 ? cell * 0.08 : 0
    const size = cell - inset * 2
    for (let i = from; i < Math.min(to, layout.cells); i++) {
      const at = goldenCell(layout, i)!
      const [x, y] = toScreen(at[0], at[1])
      ctx.fillStyle = colors[digitAt(i)]!
      ctx.fillRect(x + inset, y + inset, size, size)
    }
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      count = to
      const needed = goldenSquaresFor(to)
      if (needed > layout.squares.length && fixedCount === undefined) {
        fit(needed)
        layer = createLayer(width, height)
        drawCells(0, to, digitAt)
      } else drawCells(from, to, digitAt)
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      if (spiral && count > 0) {
        // Square outlines, then the spiral through every square reached so far.
        ctx.lineWidth = Math.max(1, scale)
        ctx.strokeStyle = SQUARE_COLOR
        for (const square of layout.squares) {
          const [x, y] = toScreen(square.x, square.y)
          const [x2, y2] = toScreen(square.x + square.side, square.y + square.side)
          ctx.strokeRect(Math.min(x, x2), Math.min(y, y2), Math.abs(x2 - x), Math.abs(y2 - y))
        }
        ctx.beginPath()
        for (const square of layout.squares) {
          if (square.first >= count) break
          const { cx, cy, from, to } = square.arc
          const [px, py] = toScreen(cx, cy)
          const [fx, fy] = toScreen(from[0], from[1])
          const [tx, ty] = toScreen(to[0], to[1])
          // Every arc turns the same way; a transposed (mirrored) layout turns the other way.
          ctx.arc(
            px,
            py,
            square.side * cell,
            Math.atan2(fy - py, fx - px),
            Math.atan2(ty - py, tx - px),
            !transposed,
          )
        }
        ctx.strokeStyle = SPIRAL_COLOR
        ctx.lineWidth = Math.max(1.5 * scale, Math.min(4 * scale, cell * 0.25))
        ctx.lineCap = 'round'
        ctx.stroke()
      }
      if (highlight && count > 0 && count <= layout.cells) {
        const at = goldenCell(layout, count - 1)!
        const [x, y] = toScreen(at[0], at[1])
        const [x2, y2] = toScreen(at[0] + 1, at[1] + 1)
        const r = Math.max(5 * scale, cell * 0.9)
        ctx.beginPath()
        ctx.arc((x + x2) / 2, (y + y2) / 2, r, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
    },
  }
}
