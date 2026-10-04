import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog, PerformedNote } from '../../core/composition/performanceLog'
import { midiToNote, noteToMidi } from '../../core/music/notes'
import {
  choosePosition,
  foldIntoRange,
  FRETS,
  getTuning,
  INLAYS,
  positionsOf,
  TUNINGS,
  type FretboardTuning,
  type FretPosition,
} from '../../viz/fretboard'
import { withAlpha } from '../../viz/palettes'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'

interface FretboardViewProps {
  log: PerformanceLog
  /** The ten notes the current scale gives the digits (marked on the board as the scale map). */
  noteTable: readonly string[]
  tuning: FretboardTuning
  onTuningChange: (tuning: FretboardTuning) => void
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

interface Placed extends FretPosition {
  digit: number
  folded: boolean
  label: string
}

const TRAIL = 8
const pitchClass = (midi: number) => ((midi % 12) + 12) % 12
const fretName = (fret: number) => (fret === 0 ? 'open' : `fret ${fret}`)

/**
 * Guitar fretboard: the scale's notes are mapped over the whole neck (the familiar "box" shapes
 * appear by themselves), and each digit's note lights the position a guitarist's hand would most
 * likely use, with a fading trail. Notes sounding together — coincidental chords — light together.
 */
export function FretboardView({
  log,
  noteTable,
  tuning,
  onTuningChange,
  onCanvas,
}: FretboardViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const [summary, setSummary] = useState('No notes yet.')
  const placed = useRef<Placed[]>([])
  const byNote = useRef(new WeakMap<PerformedNote, Placed>())
  const hand = useRef<number | null>(null)
  const strings = getTuning(tuning).strings

  useEffect(() => {
    // A new tuning moves every position: place the notes again.
    placed.current = []
    hand.current = null
  }, [tuning])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const s = size.ratio
    const w = canvas.width
    const h = canvas.height
    // Room on the left for string names, then open-string notes, then the nut.
    const left = 52 * s
    const right = w - 12 * s
    const top = 44 * s
    // Fret numbers sit above the tuning control at the bottom.
    const bottom = h - 92 * s
    const boardH = Math.max(60 * s, bottom - top)
    // Real fret spacing (equal temperament): fret f sits at 1 − 2^(−f/12) of the scale length.
    const span = 1 - 2 ** (-(FRETS + 0.6) / 12)
    const fretX = (f: number) => left + ((1 - 2 ** (-f / 12)) / span) * (right - left)
    const noteX = (f: number) => (f === 0 ? left - 16 * s : (fretX(f - 1) + fretX(f)) / 2)
    // High string on top, like tablature.
    const stringY = (i: number) => top + ((strings.length - 1 - i) / (strings.length - 1)) * boardH
    const scaleDigit = new Map<number, number>()
    noteTable.forEach((note, digit) => {
      const pc = pitchClass(noteToMidi(note))
      if (!scaleDigit.has(pc)) scaleDigit.set(pc, digit)
    })
    let frame = 0

    const place = () => {
      const notes = log.notes
      if (notes.length < placed.current.length) {
        placed.current = []
        hand.current = null
      }
      for (let i = placed.current.length; i < notes.length; i++) {
        const note = notes[i]!
        const { midi, folded } = foldIntoRange(note.midi, strings)
        const at = choosePosition(positionsOf(midi, strings), hand.current) ?? {
          string: 0,
          fret: 0,
        }
        if (at.fret > 0) hand.current = at.fret
        const spot = { ...at, digit: note.digit, folded, label: note.note }
        placed.current.push(spot)
        byNote.current.set(note, spot)
      }
    }

    const dot = (x: number, y: number, r: number, fill: string, hollow = false) => {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      if (hollow) {
        ctx.lineWidth = 2.5 * s
        ctx.strokeStyle = fill
        ctx.stroke()
      } else {
        ctx.fillStyle = fill
        ctx.fill()
      }
    }

    const draw = () => {
      frame = 0
      place()
      ctx.clearRect(0, 0, w, h)

      // Board, frets, inlays, nut.
      ctx.fillStyle = 'rgba(120, 82, 52, 0.18)'
      ctx.fillRect(left, top - 10 * s, fretX(FRETS + 0.6) - left, boardH + 20 * s)
      ctx.fillStyle = 'rgba(230, 236, 245, 0.18)'
      for (const f of INLAYS) {
        const x = noteX(f)
        if (f === 12) {
          dot(x, top + boardH * 0.3, 4 * s, ctx.fillStyle)
          dot(x, top + boardH * 0.7, 4 * s, ctx.fillStyle)
        } else dot(x, top + boardH / 2, 4 * s, ctx.fillStyle)
      }
      ctx.strokeStyle = 'rgba(201, 214, 232, 0.35)'
      for (let f = 1; f <= FRETS; f++) {
        ctx.lineWidth = 1.5 * s
        ctx.beginPath()
        ctx.moveTo(fretX(f), top - 10 * s)
        ctx.lineTo(fretX(f), top + boardH + 10 * s)
        ctx.stroke()
      }
      ctx.fillStyle = '#e6ecf5'
      ctx.fillRect(left - 3 * s, top - 10 * s, 5 * s, boardH + 20 * s)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${11 * s}px system-ui, sans-serif`
      ctx.fillStyle = 'rgba(201, 214, 232, 0.6)'
      for (const f of INLAYS) ctx.fillText(String(f), noteX(f), top + boardH + 24 * s)

      // Strings (thicker for lower ones) and their open-note names.
      strings.forEach((open, i) => {
        const y = stringY(i)
        ctx.strokeStyle = 'rgba(214, 220, 230, 0.7)'
        ctx.lineWidth = (0.8 + (strings.length - 1 - i) * 0.35) * s
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(fretX(FRETS + 0.6), y)
        ctx.stroke()
        ctx.fillStyle = 'rgba(201, 214, 232, 0.8)'
        ctx.font = `600 ${12 * s}px system-ui, sans-serif`
        ctx.fillText(midiToNote(open).replace(/\d/, ''), 12 * s, y)
      })

      // Scale map: every position of the scale's pitch classes, in the digit's colour.
      strings.forEach((open, i) => {
        for (let f = 0; f <= FRETS; f++) {
          const digit = scaleDigit.get(pitchClass(open + f))
          if (digit === undefined) continue
          dot(noteX(f), stringY(i), 4.5 * s, withAlpha(colors[digit]!, 0.45))
        }
      })

      // Trail of recent notes, then the notes sounding now.
      const all = placed.current
      const trail = all.slice(-TRAIL - 1, -1)
      trail.forEach((p, k) => {
        const alpha = ((k + 1) / (trail.length + 1)) * 0.7
        dot(noteX(p.fret), stringY(p.string), 8 * s, withAlpha(colors[p.digit]!, alpha), p.folded)
      })
      const now = log
        .soundingAt(log.lastOnsetSec)
        .map((note) => byNote.current.get(note))
        .filter((p): p is Placed => p !== undefined)
      for (const p of now) {
        const x = noteX(p.fret)
        const y = stringY(p.string)
        dot(x, y, 12 * s, colors[p.digit]!, p.folded)
        ctx.lineWidth = 2 * s
        ctx.strokeStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(x, y, 13.5 * s, 0, Math.PI * 2)
        ctx.stroke()
        if (!p.folded) {
          // White label with a dark outline reads on every digit colour.
          const name = p.label.replace(/\d/, '')
          ctx.font = `700 ${11 * s}px system-ui, sans-serif`
          ctx.lineWidth = 3 * s
          ctx.strokeStyle = 'rgba(11, 11, 18, 0.85)'
          ctx.strokeText(name, x, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(name, x, y)
        }
      }

      // Caption: chord name or the latest note and where it is played.
      const chord = log.chords.at(-1)
      const isChord = Boolean(chord && log.lastStep && chord.index === log.lastStep.index)
      const latest = all.at(-1)
      let caption = ''
      if (isChord && chord) caption = `${chord.chord.symbol} · ${now.length} strings`
      else if (latest)
        caption = `${latest.label}${latest.folded ? ' (moved by octaves to fit the neck)' : ''} · string ${strings.length - latest.string}, ${fretName(latest.fret)}`
      ctx.textAlign = 'left'
      ctx.fillStyle = isChord ? '#ffe08a' : '#c9d6e8'
      ctx.font = `600 ${15 * s}px system-ui, sans-serif`
      ctx.fillText(caption, left, 18 * s)
      setSummary(caption ? `Now: ${caption}.` : 'No notes yet.')
    }

    draw()
    const unsubscribe = log.subscribe(() => {
      if (!frame) frame = requestAnimationFrame(draw)
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [canvasRef, size, colors, log, noteTable, strings])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={`Guitar fretboard (${getTuning(tuning).name}): the scale's notes are marked along the neck and each note lights where it would be played. ${summary}`}
      />
      <label className="viz-toggle viz-toggle-bottom">
        Tuning
        <select value={tuning} onChange={(e) => onTuningChange(e.target.value as FretboardTuning)}>
          {TUNINGS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
