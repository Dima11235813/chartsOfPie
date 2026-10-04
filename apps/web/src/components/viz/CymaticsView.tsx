import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import { noteToMidi } from '../../core/music/notes'
import { modeForMidi, settleGrains, type Mode } from '../../viz/chladni'
import { mixColors } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface CymaticsViewProps {
  log: PerformanceLog
  /** The digits' notes; the lowest one maps to the simplest figure. */
  noteTable: readonly string[]
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const GRAINS = 9000

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
    const reduced = prefersReducedMotion()
    let mode: Mode | null = null
    let color = colors[3]!
    let frame = 0
    let lastKey = ''

    const listen = () => {
      // The newest note sets the plate's mode (a real plate rings at the frequency it is driven).
      const latest = log.notes.at(-1)
      if (!latest) return
      mode = modeForMidi(latest.midi, lowest)
      // Lighten the digit's colour so sand reads on the dark plate in every palette.
      color = mixColors(colors[latest.digit]!, '#ffffff', 0.35)
      const key = `${latest.note}:${mode.join(':')}`
      if (key !== lastKey) {
        lastKey = key
        setCaption(`${latest.note} · plate mode (${mode[0]}, ${mode[1]})`)
      }
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (mode) {
        // Grains slide off the moving parts onto the still (nodal) lines; a few sub-steps per
        // frame so a figure forms in about a second.
        const steps = reduced ? 1 : 3
        for (let s = 0; s < steps; s++) settleGrains(sand, mode, Math.random)
      }
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(201, 214, 232, 0.06)'
      ctx.fillRect(left, top, side, side)
      ctx.fillStyle = color
      const grain = Math.max(1, size.ratio * 1.2)
      for (let i = 0; i < sand.length; i += 2) {
        ctx.fillRect(left + sand[i]! * side, top + sand[i + 1]! * side, grain, grain)
      }
    }

    listen()
    draw()
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
