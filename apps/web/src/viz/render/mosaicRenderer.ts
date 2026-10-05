import { earlierNeighbours, mosaicColumnsCell, mosaicGroupSizes } from '../art'
import { createLayer, type DigitAt, type DigitRenderer, type RendererOptions } from './renderer'

/** Live cell sizes (CSS px), largest first. */
const LIVE_CELLS = [36, 26, 18, 13] as const

export interface MosaicOptions {
  /** Cell size in pixels; if omitted, cells are sized to fit `fitCount` digits. */
  cell?: number
  /** For posters: size the grid to show exactly this many digits. */
  fitCount?: number
  /**
   * Fixed number of columns (the grid narrows or widens instead of filling the frame). Digits
   * `columns` apart sit on top of each other, so repeats at that distance show as vertical links.
   */
  columns?: number
  /**
   * Groups only: show just the digits that belong to a group of at least this many equal
   * neighbours (others become faint dots). 0 or 1 = show everything.
   */
  minGroup?: number
}

/**
 * Neighbour mosaic (our third inspiration image): digits as coloured dots in rows; equal neighbours
 * (left, up-left, up, up-right) are joined, so runs and repeats light up as chains — the Feynman
 * point "999999" at decimal 762 becomes a bright bar. Live, it scrolls to keep the newest rows.
 */
export function createMosaicRenderer(
  { width, height, scale, colors }: RendererOptions,
  { cell: fixedCell, fitCount, columns, minGroup = 0 }: MosaicOptions = {},
): DigitRenderer {
  const pad = 10 * scale
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const fitCell = (n: number) => {
    // Largest cell with cols × rows ≥ n in the frame.
    let c = Math.sqrt((innerW * innerH) / n)
    while (Math.floor(innerW / c) * Math.floor(innerH / c) < n) c *= 0.98
    return c
  }
  /** Poster with fixed columns: the largest cell that fits the width and all the rows. */
  const fitColumnsCell = (n: number, cols: number) =>
    Math.min(innerW / cols, innerH / Math.max(1, Math.ceil(n / cols)))
  /** Live: start with big cells and step down as the frame fills, then scroll at the smallest. */
  const liveCell = (n: number) => {
    if (columns) return mosaicColumnsCell(innerW, innerH, columns, n, scale)
    for (const size of LIVE_CELLS) {
      const c = size * scale
      if (Math.floor(innerW / c) * Math.floor(innerH / c) >= n) return c
    }
    return LIVE_CELLS.at(-1)! * scale
  }
  let cell =
    fixedCell ??
    (fitCount ? (columns ? fitColumnsCell(fitCount, columns) : fitCell(fitCount)) : liveCell(1))
  let cols = 1
  let visibleRows = 1
  let x0 = pad
  const layout = () => {
    cols = columns ?? Math.max(1, Math.floor(innerW / cell))
    visibleRows = Math.max(1, Math.floor(innerH / cell))
    x0 = pad + (innerW - cols * cell) / 2
  }
  layout()
  let layer = createLayer(width, height)
  let firstRow = 0
  let count = 0
  let source: DigitAt | null = null

  const centre = (index: number): [number, number] => {
    const row = Math.floor(index / cols) - firstRow
    return [x0 + (index % cols) * cell + cell / 2, pad + row * cell + cell / 2]
  }

  const groupsOnly = minGroup > 1

  /** Groups only: re-group everything visible (a group can grow later) and redraw the layer. */
  const drawGroups = (to: number, digitAt: DigitAt) => {
    const firstIndex = firstRow * cols
    const digits = new Uint8Array(Math.max(0, to - firstIndex))
    for (let i = 0; i < digits.length; i++) digits[i] = digitAt(firstIndex + i)
    const sizes = mosaicGroupSizes(digits, cols, firstIndex)
    layer = createLayer(width, height)
    const ctx = layer.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1, cell * 0.2)
    const dot = Math.max(0.6, cell * 0.3)
    const faint = 'rgba(201, 214, 232, 0.08)'
    for (let k = 0; k < digits.length; k++) {
      const i = firstIndex + k
      const [x, y] = centre(i)
      const shown = sizes[k]! >= minGroup
      const color = colors[digits[k]!]!
      if (shown) {
        for (const j of earlierNeighbours(i, cols)) {
          const jk = j - firstIndex
          if (jk < 0 || digits[jk] !== digits[k]) continue
          const [px, py] = centre(j)
          ctx.strokeStyle = color
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
      }
      ctx.fillStyle = shown ? color : faint
      ctx.beginPath()
      ctx.arc(x, y, shown ? dot : dot * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawCells = (from: number, to: number, digitAt: DigitAt) => {
    const ctx = layer.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1, cell * 0.2)
    const dot = Math.max(0.6, cell * 0.3)
    const firstIndex = firstRow * cols
    for (let i = Math.max(from, firstIndex); i < to; i++) {
      const digit = digitAt(i)
      const [x, y] = centre(i)
      const color = colors[digit]!
      for (const j of earlierNeighbours(i, cols)) {
        if (j < firstIndex || digitAt(j) !== digit) continue
        const [px, py] = centre(j)
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, dot, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return {
    columns: () => cols,

    draw(from: number, to: number, digitAt: DigitAt) {
      source = digitAt
      count = to
      if (!fixedCell && !fitCount) {
        const next = liveCell(to)
        if (next !== cell) {
          cell = next
          layout()
          firstRow = 0
          layer = createLayer(width, height)
          from = 0
        }
      }
      const rows = Math.ceil(to / cols)
      if (groupsOnly) {
        if (rows - firstRow > visibleRows) {
          const headroom = Math.min(4, Math.floor(visibleRows / 4))
          firstRow = Math.min(rows - 1, rows - visibleRows + headroom)
        }
        drawGroups(to, digitAt)
        return
      }
      if (rows - firstRow > visibleRows) {
        // Scroll, leaving a few empty rows below so the next redraw is a while away.
        const headroom = Math.min(4, Math.floor(visibleRows / 4))
        firstRow = Math.min(rows - 1, rows - visibleRows + headroom)
        layer = createLayer(width, height)
        drawCells(firstRow * cols, to, digitAt)
      } else {
        drawCells(from, to, digitAt)
      }
    },

    compose(ctx, { highlight }) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(layer, 0, 0)
      if (highlight && count > 0 && source) {
        const [x, y] = centre(count - 1)
        ctx.beginPath()
        ctx.arc(x, y, Math.max(cell * 0.55, 4 * scale), 0, Math.PI * 2)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5 * scale
        ctx.stroke()
      }
    },
  }
}
