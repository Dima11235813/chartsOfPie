import { runLengthEndingAt } from '../art'
import { withAlpha } from '../palettes'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/** Live cell sizes (CSS px), largest first; the text steps down as the frame fills, then scrolls. */
const LIVE_CELLS = [34, 26, 20, 15] as const
/** Runs of at least this many equal digits are highlighted. */
const MIN_RUN = 3

/**
 * Typographic π: the digits themselves, set in a monospaced grid and coloured by digit. Runs of
 * three or more equal digits glow behind the type — the Feynman point "999999" at decimal 762 is
 * the famous one. The first cell is "3" followed by the decimal point.
 */
export function createTypeRenderer(
  { width, height, scale, colors }: RendererOptions,
  { fitCount }: { fitCount?: number } = {},
): DigitRenderer {
  const pad = 12 * scale
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const fits = (c: number, n: number) => Math.floor(innerW / c) * Math.floor(innerH / c) >= n
  const pickCell = (n: number) => {
    if (fitCount) {
      let c = Math.sqrt((innerW * innerH) / fitCount)
      while (!fits(c, fitCount)) c *= 0.98
      return c
    }
    return (LIVE_CELLS.find((size) => fits(size * scale, n)) ?? LIVE_CELLS.at(-1)!) * scale
  }

  let cell = pickCell(fitCount ?? 1)
  let cols = 1
  let visibleRows = 1
  let x0 = pad
  let firstRow = 0
  let count = 0
  let glow = createLayer(width, height)
  let text = createLayer(width, height)
  const layout = () => {
    cols = Math.max(1, Math.floor(innerW / cell))
    visibleRows = Math.max(1, Math.floor(innerH / cell))
    x0 = pad + (innerW - cols * cell) / 2
  }
  layout()

  const origin = (i: number): [number, number] => [
    x0 + (i % cols) * cell,
    pad + (Math.floor(i / cols) - firstRow) * cell,
  ]

  const drawRange = (from: number, to: number, digitAt: DigitAt) => {
    const t = text.getContext('2d')!
    const g = glow.getContext('2d')!
    t.font = `600 ${Math.round(cell * 0.72)}px ui-monospace, Menlo, Consolas, monospace`
    t.textAlign = 'center'
    t.textBaseline = 'middle'
    const firstIndex = firstRow * cols
    for (let i = Math.max(from, firstIndex); i < to; i++) {
      const digit = digitAt(i)
      const [x, y] = origin(i)
      t.fillStyle = colors[digit]!
      t.fillText(String(digit), x + cell / 2, y + cell / 2)
      if (i === 0) t.fillText('.', x + cell * 0.95, y + cell * 0.62)
      const run = runLengthEndingAt(digitAt, i)
      if (run >= MIN_RUN) {
        // Light the whole run (earlier cells too, the moment it reaches MIN_RUN).
        g.fillStyle = withAlpha(colors[digit]!, 0.28)
        for (let j = Math.max(firstIndex, i - run + 1); j <= i; j++) {
          const [gx, gy] = origin(j)
          g.beginPath()
          g.roundRect(gx + cell * 0.06, gy + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.2)
          g.fill()
        }
      }
    }
  }

  return {
    draw(from: number, to: number, digitAt: DigitAt) {
      count = to
      if (!fitCount) {
        const next = pickCell(to)
        if (next !== cell) {
          cell = next
          layout()
          firstRow = 0
          glow = createLayer(width, height)
          text = createLayer(width, height)
          from = 0
        }
      }
      const rows = Math.ceil(to / cols)
      if (rows - firstRow > visibleRows) {
        const headroom = Math.min(4, Math.floor(visibleRows / 4))
        firstRow = Math.min(rows - 1, rows - visibleRows + headroom)
        glow = createLayer(width, height)
        text = createLayer(width, height)
        drawRange(firstRow * cols, to, digitAt)
      } else {
        drawRange(from, to, digitAt)
      }
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(glow, 0, 0)
      ctx.drawImage(text, 0, 0)
      if (highlight && count > 0) {
        const [x, y] = origin(count - 1)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
      }
    },
  }
}
