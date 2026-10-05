import { useEffect, useRef } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { earlierNeighbours, mosaicGroupSizes, sweepColumns } from '../../viz/art'
import {
  approach,
  mosaicGroups,
  sweepFrame,
  sweepTarget,
  SWEEP_MAX_WINDOW,
  type SweepFrame,
} from '../../viz/mosaicShapes'
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

/**
 * The neighbour mosaic's sweep, drawn continuously: the width steps from `low` to `high` columns
 * and back, every dot glides to its new place, links stretch with the dots and groups fade in as
 * they form. Each width fills the frame (wider = smaller cells and more digits), so older digits
 * fade in at the top as the grid widens and slide out of the top as it narrows. The width holds
 * at each step long enough to read the shapes before moving on.
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
    /** Dot size, eased towards the current width's cell so it shrinks and grows smoothly. */
    let cellShown = 0
    /** First digit still drawn: digits before `start` are fading out. */
    let drawStart = -1
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
      const key = `${cols}:${drawStart}:${played}:${minGroup}:${shapeFilter ?? ''}`
      if (key === groupsKey) return
      groupsKey = key
      if (shapeFilter) {
        shown = new Uint8Array(digits.length)
        for (const group of mosaicGroups(digits, cols, drawStart, 2, 9)) {
          if (group.shape !== shapeFilter) continue
          for (const i of group.indices) shown[i - drawStart] = 1
        }
      } else if (minGroup > 1) {
        const sizes = mosaicGroupSizes(digits, cols, drawStart)
        shown = new Uint8Array(sizes.length)
        for (let k = 0; k < sizes.length; k++) shown[k] = sizes[k]! >= minGroup ? 1 : 0
      } else {
        shown = new Uint8Array(digits.length).fill(1)
      }
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const played = log.stepCount
      const nextCols = sweepColumns((now - begun) / 1000, low, high, pace)
      if (nextCols !== cols) {
        cols = nextCols
        layoutAt = now
        onLayoutRef.current(cols)
      }
      frame = sweepFrame(w, h, size.ratio, cols, played)
      start = played - frame.window
      const tau = reduced ? TAU * 2 : TAU
      // Digits that left the window (the grid narrowed, or newer ones pushed them out) fade out
      // first; new ones fade in from wherever they first appear.
      if (drawStart < 0 || drawStart > start || start - drawStart > SWEEP_MAX_WINDOW) {
        drawStart = start
      }
      while (drawStart < start && alpha[drawStart & (CAP - 1)]! < 0.02) drawStart++
      if (loaded !== `${drawStart}:${played}`) {
        loaded = `${drawStart}:${played}`
        digits = new Uint8Array(played - drawStart)
        for (let k = 0; k < digits.length; k++) digits[k] = source.digitAt(drawStart + k)
      }
      regroup(played)

      ctx.clearRect(0, 0, w, h)
      cellShown = cellShown ? approach(cellShown, frame.cell, dt, tau) : frame.cell
      const dot = Math.max(0.8, cellShown * 0.3)
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1, cellShown * 0.2)
      const linkAlpha = Math.min(1, (now - layoutAt) / 300)

      // Move every dot towards its place in the current layout.
      for (let k = 0; k < digits.length; k++) {
        const i = drawStart + k
        const slot = i & (CAP - 1)
        const [tx, ty] = sweepTarget(frame, cols, start, i)
        const ta = i < start ? 0 : shown[k] ? 1 : FAINT
        if (owner[slot] !== i) {
          owner[slot] = i
          posX[slot] = tx
          posY[slot] = ty
          alpha[slot] = 0
        }
        posX[slot] = approach(posX[slot]!, tx, dt, tau)
        posY[slot] = approach(posY[slot]!, ty, dt, tau)
        alpha[slot] = approach(alpha[slot]!, ta, dt, tau)
      }

      // Links of the current layout between shown equal neighbours, fading in after each step.
      for (let k = 0; k < digits.length; k++) {
        if (!shown[k]) continue
        const i = drawStart + k
        const slot = i & (CAP - 1)
        for (const j of earlierNeighbours(i, cols)) {
          const jk = j - drawStart
          if (jk < 0 || digits[jk] !== digits[k] || !shown[jk]) continue
          const other = j & (CAP - 1)
          ctx.globalAlpha = linkAlpha * Math.min(alpha[slot]!, alpha[other]!)
          ctx.strokeStyle = colors[digits[k]!]!
          ctx.beginPath()
          ctx.moveTo(posX[other]!, posY[other]!)
          ctx.lineTo(posX[slot]!, posY[slot]!)
          ctx.stroke()
        }
      }
      for (let k = 0; k < digits.length; k++) {
        const slot = (drawStart + k) & (CAP - 1)
        const a = alpha[slot]!
        ctx.globalAlpha = a
        ctx.fillStyle = a > FAINT * 1.5 ? colors[digits[k]!]! : 'rgb(201, 214, 232)'
        ctx.beginPath()
        ctx.arc(posX[slot]!, posY[slot]!, a > FAINT * 1.5 ? dot : dot * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
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
