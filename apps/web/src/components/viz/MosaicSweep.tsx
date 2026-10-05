import { useEffect, useRef } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { mosaicGroupSizes, sweepColumns } from '../../viz/art'
import { mosaicGroups, sweepFrame, type SweepFrame } from '../../viz/mosaicShapes'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface MosaicSweepProps {
  source: DigitSource
  log: PerformanceLog
  low: number
  high: number
  /** Columns per second. */
  speed: number
  minGroup: number
  /** Show only groups with this free shape (from the shape census), or null. */
  shapeFilter: string | null
  onLayout: (columns: number) => void
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/** Glide time constant (s): ~95 % of the way after 3τ. */
const TAU = 0.14
const FAINT = 0.1
const FAINT_COLOR = 'rgb(201, 214, 232)'
/** Above this many dots, rasterising them dominates: draw at most every other frame (~30 fps). */
const MANY_DOTS = 1500
const MANY_DOTS_FRAME_MS = 1000 / 30 - 2

/**
 * The neighbour mosaic's sweep, drawn continuously: the width steps from `low` to `high` columns
 * and back, every dot glides to its new place (fixed cell size, so nothing jumps or rescales),
 * links stretch with the dots and groups fade in as they form. The width holds at each step long
 * enough to read the shapes before moving on.
 */
export function MosaicSweep({
  source,
  log,
  low,
  high,
  speed,
  minGroup,
  shapeFilter,
  onLayout,
  onCanvas,
}: MosaicSweepProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const onLayoutRef = useRef(onLayout)
  useEffect(() => {
    onLayoutRef.current = onLayout
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const w = canvas.width
    const h = canvas.height
    const reduced = prefersReducedMotion()
    const pace = reduced ? speed / 4 : speed

    // Displayed state per digit, in a ring keyed by index (only the window is ever on screen).
    const CAP = 1 << 15
    const owner = new Int32Array(CAP).fill(-1)
    const posX = new Float32Array(CAP)
    const posY = new Float32Array(CAP)
    const alpha = new Float32Array(CAP)

    let frame: SweepFrame | null = null
    let cols = low
    let layoutAt = 0
    let groupsKey = ''
    let shown = new Uint8Array(0)
    let start = 0
    let digits = new Uint8Array(0)
    let loaded = ''
    const begun = performance.now()
    let last = begun
    let raf = 0

    const regroup = (played: number) => {
      const key = `${cols}:${start}:${played}:${minGroup}:${shapeFilter ?? ''}`
      if (key === groupsKey) return
      groupsKey = key
      if (shapeFilter) {
        shown = new Uint8Array(digits.length)
        for (const group of mosaicGroups(digits, cols, start, 2, 9)) {
          if (group.shape !== shapeFilter) continue
          for (const i of group.indices) shown[i - start] = 1
        }
      } else if (minGroup > 1) {
        const sizes = mosaicGroupSizes(digits, cols, start)
        shown = new Uint8Array(sizes.length)
        for (let k = 0; k < sizes.length; k++) shown[k] = sizes[k]! >= minGroup ? 1 : 0
      } else {
        shown = new Uint8Array(digits.length).fill(1)
      }
    }

    // Nothing moves once the dots have reached their places and the links have faded in; frames
    // after that are skipped until the width, the digits or the grouping change.
    let settled = false
    let lastPlayed = -1

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (digits.length > MANY_DOTS && now - last < MANY_DOTS_FRAME_MS) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const played = log.stepCount
      const nextCols = sweepColumns((now - begun) / 1000, low, high, pace)
      if (nextCols !== cols) {
        cols = nextCols
        layoutAt = now
        settled = false
        onLayoutRef.current(cols)
      }
      if (played !== lastPlayed) {
        lastPlayed = played
        settled = false
      }
      if (settled) return
      frame = sweepFrame(w, h, size.ratio, low, high, played)
      start = played - frame.window
      if (loaded !== `${start}:${frame.window}`) {
        loaded = `${start}:${frame.window}`
        digits = new Uint8Array(frame.window)
        for (let k = 0; k < digits.length; k++) digits[k] = source.digitAt(start + k)
      }
      regroup(played)

      const tau = reduced ? TAU * 2 : TAU
      const step = 1 - Math.exp(-dt / tau)
      const { cell, left, top, innerWidth } = frame
      // Same layout as sweepTarget, inlined: this runs for every digit on every frame.
      const x0 = left + (innerWidth - cols * cell) / 2 + cell / 2
      const y0 = top + cell / 2
      const firstRow = Math.floor(start / cols)
      let moving = 0

      // Move every dot towards its place in the current layout.
      for (let k = 0; k < digits.length; k++) {
        const i = start + k
        const slot = i & (CAP - 1)
        const tx = x0 + (i % cols) * cell
        const ty = y0 + (Math.floor(i / cols) - firstRow) * cell
        const ta = shown[k] ? 1 : FAINT
        if (owner[slot] !== i) {
          owner[slot] = i
          posX[slot] = tx
          posY[slot] = ty
          alpha[slot] = 0
        }
        const dx = tx - posX[slot]!
        const dy = ty - posY[slot]!
        const da = ta - alpha[slot]!
        posX[slot] = posX[slot]! + dx * step
        posY[slot] = posY[slot]! + dy * step
        alpha[slot] = alpha[slot]! + da * step
        moving = Math.max(moving, Math.abs(dx), Math.abs(dy), Math.abs(da) * 40)
      }
      const linkAlpha = Math.min(1, (now - layoutAt) / 300)
      settled = moving < 0.3 && linkAlpha >= 1

      ctx.clearRect(0, 0, w, h)
      const dot = Math.max(0.8, cell * 0.3)
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1, cell * 0.2)
      // Fully faded-in dots and links are batched into one path per digit colour (a few calls a
      // frame instead of thousands); only the ones still fading are drawn one by one.
      const links = colors.map(() => new Path2D())
      const dots = colors.map(() => new Path2D())
      const faint = new Path2D()
      const opaque = (a: number) => a > 0.98

      // Links of the current layout between shown equal neighbours, fading in after each step.
      for (let k = 0; k < digits.length; k++) {
        if (!shown[k]) continue
        const i = start + k
        const slot = i & (CAP - 1)
        const digit = digits[k]!
        const col = i % cols
        for (let n = 0; n < 4; n++) {
          // Earlier neighbours: left, up-left, up, up-right (see earlierNeighbours).
          if ((n < 2 && col === 0) || (n === 3 && col === cols - 1)) continue
          const j = n === 0 ? i - 1 : i - cols - 1 + (n - 1)
          const jk = j - start
          if (jk < 0 || digits[jk] !== digit || !shown[jk]) continue
          const other = j & (CAP - 1)
          const a = Math.min(alpha[slot]!, alpha[other]!)
          if (opaque(a)) {
            links[digit]!.moveTo(posX[other]!, posY[other]!)
            links[digit]!.lineTo(posX[slot]!, posY[slot]!)
            continue
          }
          ctx.globalAlpha = linkAlpha * a
          ctx.strokeStyle = colors[digit]!
          ctx.beginPath()
          ctx.moveTo(posX[other]!, posY[other]!)
          ctx.lineTo(posX[slot]!, posY[slot]!)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = linkAlpha
      links.forEach((path, digit) => {
        ctx.strokeStyle = colors[digit]!
        ctx.stroke(path)
      })

      for (let k = 0; k < digits.length; k++) {
        const slot = (start + k) & (CAP - 1)
        const a = alpha[slot]!
        const x = posX[slot]!
        const y = posY[slot]!
        const strong = a > FAINT * 1.5
        const r = strong ? dot : dot * 0.6
        if (opaque(a) || (!shown[k] && Math.abs(a - FAINT) < 0.01)) {
          const path = opaque(a) ? dots[digits[k]!]! : faint
          path.moveTo(x + r, y)
          path.arc(x, y, r, 0, Math.PI * 2)
          continue
        }
        ctx.globalAlpha = a
        ctx.fillStyle = strong ? colors[digits[k]!]! : FAINT_COLOR
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      dots.forEach((path, digit) => {
        ctx.fillStyle = colors[digit]!
        ctx.fill(path)
      })
      ctx.globalAlpha = FAINT
      ctx.fillStyle = FAINT_COLOR
      ctx.fill(faint)
      ctx.globalAlpha = 1
    }
    onLayoutRef.current(cols)
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [canvasRef, size, colors, source, log, low, high, speed, minGroup, shapeFilter])

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`Neighbour mosaic, sweeping from ${low} to ${high} columns and back: each digit glides to its place in the next width, so groups of equal neighbours slide past each other, join and split.`}
    />
  )
}
