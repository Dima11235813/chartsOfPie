import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import { intervalName } from '../../core/music/chords'
import { noteToMidi, PITCH_CLASSES } from '../../core/music/notes'
import { clockAngle, polar, type ClockOrder } from '../../viz/art'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'

interface MusicClockViewProps {
  order: ClockOrder
  onOrderChange: (order: ClockOrder) => void
  log: PerformanceLog
  /** The ten notes the current scale gives the digits (to highlight the scale on the rim). */
  noteTable: readonly string[]
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const TRAIL = 16
const pitchClass = (midi: number) => ((midi % 12) + 12) % 12

/**
 * Music clock: the twelve pitch classes around a circle (chromatic order or the circle of fifths).
 * The melody draws a fading trail between successive notes; the notes sounding together form a
 * glowing polygon, and when they make a chord its name appears in the middle. The scale's notes are
 * lit on the rim and dot size shows how often each pitch class has been played.
 */
export function MusicClockView({
  log,
  noteTable,
  order,
  onOrderChange,
  onCanvas,
}: MusicClockViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [summary, setSummary] = useState('No notes yet.')
  const counts = useRef(new Uint32Array(12))
  const counted = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const scale = size.ratio
    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) / 2 - 46 * scale
    const scalePcs = new Set(noteTable.map((note) => pitchClass(noteToMidi(note))))
    const at = (pc: number, r = radius): [number, number] => {
      const [x, y] = polar(clockAngle(pc, order), r)
      return [cx + x, cy + y]
    }
    let frame = 0

    const draw = () => {
      frame = 0
      const notes = log.notes
      // Pitch-class histogram, counted incrementally (reset when the log is reset).
      if (notes.length < counted.current) {
        counts.current.fill(0)
        counted.current = 0
      }
      for (let i = counted.current; i < notes.length; i++)
        counts.current[pitchClass(notes[i]!.midi)]!++
      counted.current = notes.length
      const max = Math.max(1, ...counts.current)

      ctx.clearRect(0, 0, w, h)
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(201, 214, 232, 0.25)'
      ctx.lineWidth = scale
      ctx.stroke()

      // Melody trail
      const trail = notes.slice(-TRAIL)
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]!
        const b = trail[i]!
        const [x1, y1] = at(pitchClass(a.midi), radius * 0.92)
        const [x2, y2] = at(pitchClass(b.midi), radius * 0.92)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = withAlpha(colors[b.digit]!, (i / trail.length) * 0.8)
        ctx.lineWidth = (1 + (i / trail.length) * 2) * scale
        ctx.stroke()
      }

      // Notes sounding now → polygon (and a chord name if they form one)
      const sounding = log.soundingAt(log.lastOnsetSec)
      const pcs = [...new Set(sounding.map((note) => pitchClass(note.midi)))].sort(
        (p, q) => clockAngle(p, order) - clockAngle(q, order),
      )
      const chord = log.chords.at(-1)
      const isChord = Boolean(chord && log.lastStep && chord.index === log.lastStep.index)
      if (pcs.length >= 2) {
        ctx.beginPath()
        pcs.forEach((pc, i) => {
          const [x, y] = at(pc, radius * 0.92)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = isChord ? 'rgba(255, 224, 138, 0.22)' : 'rgba(143, 211, 255, 0.12)'
        ctx.strokeStyle = isChord ? '#ffe08a' : 'rgba(143, 211, 255, 0.7)'
        ctx.lineWidth = 2 * scale
        ctx.fill()
        ctx.stroke()
      }

      // Rim: twelve pitch classes
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let pc = 0; pc < 12; pc++) {
        const inScale = scalePcs.has(pc)
        const [x, y] = at(pc)
        const dot = (3 + Math.sqrt(counts.current[pc]! / max) * 9) * scale
        ctx.beginPath()
        ctx.arc(x, y, dot, 0, Math.PI * 2)
        const digit = noteTable.findIndex((note) => pitchClass(noteToMidi(note)) === pc)
        ctx.fillStyle = digit >= 0 ? colors[digit]! : 'rgba(201, 214, 232, 0.25)'
        ctx.fill()
        if (pcs.includes(pc)) {
          ctx.lineWidth = 2 * scale
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
        }
        const [lx, ly] = at(pc, radius + 28 * scale)
        ctx.fillStyle = inScale ? '#e6ecf5' : 'rgba(201, 214, 232, 0.4)'
        ctx.font = `${(inScale ? 600 : 400) + ' '}${14 * scale}px system-ui, sans-serif`
        ctx.fillText(PITCH_CLASSES[pc]!.replace('#', '♯'), lx, ly)
      }

      // Centre caption
      let caption = ''
      if (isChord && chord) caption = chord.chord.symbol
      else if (sounding.length === 2) caption = intervalName(sounding[0]!.midi, sounding[1]!.midi)
      else if (sounding.length === 1) caption = sounding[0]!.note
      ctx.fillStyle = isChord ? '#ffe08a' : '#c9d6e8'
      ctx.font = `600 ${Math.round((isChord ? 30 : 18) * scale)}px system-ui, sans-serif`
      ctx.fillText(caption, cx, cy)
      setSummary(
        caption
          ? `Now: ${caption}. Sounding ${sounding.map((n) => n.note).join(', ') || 'nothing'}.`
          : 'No notes yet.',
      )
    }

    draw()
    const unsubscribe = log.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(draw)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [canvasRef, size, colors, log, noteTable, order])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={`Music clock (${order === 'fifths' ? 'circle of fifths' : 'chromatic'}): notes on a circle of twelve pitch classes; notes sounding together form a shape. ${summary}`}
      />
      <label className="viz-toggle">
        <input
          type="checkbox"
          checked={order === 'fifths'}
          onChange={(e) => onOrderChange(e.target.checked ? 'fifths' : 'chromatic')}
        />
        Circle of fifths
      </label>
    </div>
  )
}
