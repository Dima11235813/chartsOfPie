import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import { noteToMidi } from '../../core/music/notes'
import { modeForMidi, settleGrains, type Mode } from '../../viz/chladni'
import { mixColors, parseColor } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface CymaticsViewProps {
  log: PerformanceLog
  /** The digits' notes; the lowest one maps to the simplest figure. */
  noteTable: readonly string[]
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const GRAINS = 9000
/** The plate: rgba(201, 214, 232, 0.06) as a little-endian RGBA word. */
const PLATE = (15 << 24) | (232 << 16) | (214 << 8) | 201
/** How long the sand keeps moving after the plate changes mode. */
const SETTLE_MS = 2500

/**
 * Cymatics: a square Chladni plate covered in sand. Each note sets the plate vibrating in its own
 * mode; grains jump wherever the plate moves and come to rest on the nodal lines, so every note
 * draws its own figure — and the sand flows from one figure into the next as π plays. Notes
 * sounding together superpose their modes.
 */
export function CymaticsView({ log, noteTable, onCanvas }: CymaticsViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [caption, setCaption] = useState('Press Play — each note shapes the sand.')
  const grains = useRef<Float32Array | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const w = canvas.width
    const h = canvas.height
    const side = Math.min(w, h) - 24 * size.ratio
    const left = (w - side) / 2
    const top = (h - side) / 2
    const lowest = Math.min(...noteTable.map(noteToMidi))
    if (!grains.current) {
      grains.current = new Float32Array(GRAINS * 2)
      for (let i = 0; i < grains.current.length; i++) grains.current[i] = Math.random()
    }
    const sand = grains.current
    const image = ctx.createImageData(Math.max(1, Math.round(side)), Math.max(1, Math.round(side)))
    const pixels = new Uint32Array(image.data.buffer)
    const reduced = prefersReducedMotion()
    let mode: Mode | null = null
    let color = colors[3]!
    let frame = 0
    let lastKey = ''
    // The sand settles within ~2 s of a new mode; after that nothing moves, so stop simulating
    // and drawing until the next note (saves ~50 % of a CPU core while it would idle).
    let activeUntil = 0
    let drawn = false

    const listen = () => {
      // The newest note sets the plate's mode (a real plate rings at the frequency it is driven).
      const latest = log.notes.at(-1)
      if (!latest) return
      const next = modeForMidi(latest.midi, lowest)
      if (!mode || next[0] !== mode[0] || next[1] !== mode[1])
        activeUntil = performance.now() + SETTLE_MS
      mode = next
      // Lighten the digit's colour so sand reads on the dark plate in every palette.
      color = mixColors(colors[latest.digit]!, '#ffffff', 0.35)
      const key = `${latest.note}:${mode.join(':')}`
      if (key !== lastKey) {
        lastKey = key
        setCaption(`${latest.note} · plate mode (${mode[0]}, ${mode[1]})`)
      }
    }

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw)
      const active = mode !== null && now < activeUntil
      if (!active && drawn) return
      drawn = true
      if (active && mode) {
        // Grains slide off the moving parts onto the still (nodal) lines; a few sub-steps per
        // frame so a figure forms in about a second.
        const steps = reduced ? 1 : 3
        for (let s = 0; s < steps; s++) settleGrains(sand, mode, Math.random)
      }
      // Write the grains straight into a pixel buffer and blit it once: 9,000 fillRect calls a
      // frame cost more than the physics.
      const rgb = parseColor(color) ?? [255, 255, 255]
      const ink = (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0] // little-endian RGBA
      pixels.fill(PLATE)
      const px = Math.round(side)
      const grain = Math.max(1, Math.round(size.ratio * 1.2))
      for (let i = 0; i < sand.length; i += 2) {
        const gx = Math.min(px - grain, Math.floor(sand[i]! * px))
        const gy = Math.min(px - grain, Math.floor(sand[i + 1]! * px))
        for (let dy = 0; dy < grain; dy++)
          pixels.fill(ink, (gy + dy) * px + gx, (gy + dy) * px + gx + grain)
      }
      ctx.clearRect(0, 0, w, h)
      ctx.putImageData(image, Math.round(left), Math.round(top))
    }

    listen()
    draw(performance.now())
    const unsubscribe = log.subscribe(listen)
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [canvasRef, size, colors, log, noteTable])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={`Cymatics: sand on a vibrating square plate gathers on the still (nodal) lines, so each note draws its own Chladni figure. ${caption}`}
      />
      <p className="viz-caption">{caption}</p>
    </div>
  )
}
