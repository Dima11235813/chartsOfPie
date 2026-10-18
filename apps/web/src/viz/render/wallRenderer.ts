import { symbolGlyph } from '../../core/digits/digitSource'
import { TRIANGLE_LAYOUT, wallCell, wallExtent, type WallLayout } from '../placeValue'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/** Largest live cell (CSS px); it shrinks as the wall outgrows the frame. */
const LIVE_CELL = 36
/** When the wall outgrows the frame, room is made for this much more, so re-lays are rare. */
const HEADROOM = 1.5
/**
 * Widest cell, as a multiple of its height. Fibonacci numbers grow by only ~0.2 digits a row, so
 * square cells make a thin sliver; bricks up to 3:1 use the frame. The triangle stays square.
 */
const BRICK = 3

/**
 * Place-value wall (R-013 L2): one row per number, right-aligned, one coloured cell per digit, so
 * equal places stand in columns (layout in viz/placeValue.ts). Live, cells start big and shrink
 * when the wall outgrows the frame; a poster fits exactly `fitCount` digits.
 */
export function createWallRenderer(
  { width, height, scale, colors }: RendererOptions,
  { layout = TRIANGLE_LAYOUT, fitCount }: { layout?: WallLayout; fitCount?: number } = {},
): DigitRenderer {
  const pad = 12 * scale
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  let rows = 0
  let wide = 0
  let count = 0
  /** Cell height, and width (wider for a sequence: bricks). */
  let cell = LIVE_CELL * scale
  let cellW = cell
  const brick = layout.kind === 'terms' ? BRICK : 1
  let right = pad + innerW
  let top = pad
  let layer = createLayer(width, height)

  /** Cell size and right edge for a wall of `r` rows by `w` cells, centred in the frame. */
  const fit = (r: number, w: number, max: number) => {
    cell = wallCell(innerW, innerH, r, w, max)
    cellW = Math.max(cell, Math.min(innerW / Math.max(1, w), cell * brick))
    right = pad + (innerW + Math.min(innerW, w * cellW)) / 2
    // A poster is centred both ways; live, the wall grows down from the top.
    if (fitCount) top = pad + (innerH - Math.min(innerH, r * cell)) / 2
  }
  if (fitCount) {
    const extent = wallExtent(layout, fitCount)
    fit(extent.rows, extent.width, Infinity)
  } else {
    // The first number sits in the middle; the wall grows down and to the left from there.
    fit(1, 1, LIVE_CELL * scale)
  }

  const origin = (i: number): [number, number] => [
    right - (layout.place(i) + 1) * cellW,
    top + layout.row(i) * cell,
  ]

  const drawRange = (from: number, to: number, digitAt: DigitAt) => {
    const g = layer.getContext('2d')!
    const gap = cell >= 6 ? Math.max(1, cell * 0.08) : 0
    const glyphs = cell >= 16 * scale
    if (glyphs) {
      g.font = `600 ${Math.round(cell * 0.55)}px ui-monospace, Menlo, Consolas, monospace`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
    }
    for (let i = from; i < to; i++) {
      const digit = digitAt(i)
      const [x, y] = origin(i)
      g.fillStyle = colors[digit]!
      g.fillRect(x + gap / 2, y + gap / 2, cellW - gap, cell - gap)
      if (glyphs) {
        g.fillStyle = 'rgba(11, 11, 18, 0.78)'
        g.fillText(symbolGlyph(digit), x + cellW / 2, y + cell / 2)
      }
    }
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      if (to <= from) return
      // Grow the extent with the digits just added (a row's width is its first digit's place + 1).
      rows = Math.max(rows, layout.row(to - 1) + 1)
      for (let i = from; i < to; i++) wide = Math.max(wide, layout.place(i) + 1)
      count = to
      if (!fitCount && (rows * cell > innerH + 0.5 || wide * cellW > right - pad + 0.5)) {
        fit(Math.ceil(rows * HEADROOM), Math.ceil(wide * HEADROOM), LIVE_CELL * scale)
        layer = createLayer(width, height)
        from = 0
      }
      drawRange(from, to, digitAt)
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      if (highlight && count > 0) {
        const [x, y] = origin(count - 1)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.strokeRect(x + 1, y + 1, Math.max(1, cellW - 2), Math.max(1, cell - 2))
      }
    },
  }
}
