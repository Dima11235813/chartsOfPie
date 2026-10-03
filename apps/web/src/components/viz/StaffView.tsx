import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import {
  BASS_LINES,
  ledgerSteps,
  MIDDLE_C_STEP,
  staffPosition,
  TREBLE_LINES,
} from '../../viz/staff'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'

interface StaffViewProps {
  log: PerformanceLog
  isPlaying: boolean
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const WINDOW_SEC = 7
const INK = '#c9d6e8'
const STAFF_INK = 'rgba(201, 214, 232, 0.55)'
const CHORD_INK = '#ffe08a'
/** Highest and lowest steps kept in view: C2 … C7. */
const LOW_STEP = 14
const HIGH_STEP = 49

/**
 * Scrolling grand staff in proportional notation: horizontal space is time, so the original's
 * random timing is shown honestly. Noteheads take their digit's colour; a bar shows each note's
 * length; chords formed by notes that happen to overlap are named above the staff.
 */
export function StaffView({ log, isPlaying, onCanvas }: StaffViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const anchor = useRef({ musical: 0, wall: 0 })
  const [summary, setSummary] = useState('No notes yet.')
  const playingRef = useRef(isPlaying)
  const colors = useDigitColors()
  const colorsRef = useRef(colors)

  useEffect(() => {
    colorsRef.current = colors
  })

  useEffect(() => {
    playingRef.current = isPlaying
    anchor.current = { musical: log.lastOnsetSec, wall: performance.now() }
  }, [isPlaying, log])

  useEffect(
    () =>
      log.subscribe(() => {
        anchor.current = { musical: log.lastOnsetSec, wall: performance.now() }
        const recentNotes = log.notes.slice(-6).map((n) => n.note)
        const chord = log.chords.at(-1)
        setSummary(
          recentNotes.length === 0
            ? 'No notes yet.'
            : `Latest notes ${recentNotes.join(', ')}.${chord ? ` Last chord ${chord.chord.symbol}.` : ''}`,
        )
      }),
    [log],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    let frame = 0

    const draw = () => {
      const { width, height, ratio } = size
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const elapsed = (performance.now() - anchor.current.wall) / 1000
      const now = playingRef.current
        ? Math.min(anchor.current.musical + elapsed, log.elapsedSec)
        : anchor.current.musical
      const top = 34
      const bottom = height - 16
      const half = (bottom - top) / (HIGH_STEP - LOW_STEP)
      const y = (step: number) => bottom - (step - LOW_STEP) * half
      const left = 46
      const playhead = left + (width - left) * 0.82
      const pxPerSec = (playhead - left) / WINDOW_SEC
      const x = (t: number) => playhead - (now - t) * pxPerSec

      // Staves and clefs
      ctx.strokeStyle = STAFF_INK
      ctx.lineWidth = 1
      for (const step of [...TREBLE_LINES, ...BASS_LINES]) {
        ctx.beginPath()
        ctx.moveTo(8, Math.round(y(step)) + 0.5)
        ctx.lineTo(width - 8, Math.round(y(step)) + 0.5)
        ctx.stroke()
      }
      ctx.fillStyle = INK
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.font = `${Math.round(half * 9)}px serif`
      ctx.fillText('𝄞', 26, y(32))
      ctx.font = `${Math.round(half * 5)}px serif`
      ctx.fillText('𝄢', 26, y(24))

      // Playhead
      ctx.strokeStyle = 'rgba(143, 211, 255, 0.5)'
      ctx.beginPath()
      ctx.moveTo(playhead + 0.5, top - 10)
      ctx.lineTo(playhead + 0.5, bottom + 8)
      ctx.stroke()

      const from = now - WINDOW_SEC - 1
      const to = now + 1

      // Chords formed by coincidence
      ctx.font = `600 ${Math.max(11, Math.round(half * 2.6))}px system-ui, sans-serif`
      for (const chord of log.chordsBetween(from, to)) {
        const cx = x(chord.atSec)
        if (cx < left - 20) continue
        const steps = chord.notes.map((n) => staffPosition(n.note).step)
        ctx.fillStyle = 'rgba(255, 224, 138, 0.12)'
        const y1 = y(Math.max(...steps)) - half * 1.6
        const y2 = y(Math.min(...steps)) + half * 1.6
        ctx.fillRect(cx - half * 1.4, y1, half * 2.8, y2 - y1)
        ctx.fillStyle = CHORD_INK
        ctx.fillText(chord.chord.symbol, cx, top - 18)
      }

      // Notes
      const chordNotes = new Set(
        log.chordsBetween(from, to).flatMap((c) => c.notes.map((n) => n.index)),
      )
      for (const note of log.notesBetween(from, to)) {
        const { step, accidental } = staffPosition(note.note)
        if (step < LOW_STEP - 4 || step > HIGH_STEP + 4) continue
        const nx = x(note.startSec)
        const ny = y(step)
        const color = colorsRef.current[note.digit]!
        const sounding = note.startSec <= now && now < note.startSec + note.durationSec

        ctx.globalAlpha = sounding ? 0.45 : 0.25
        ctx.fillStyle = color
        const barEnd = Math.min(x(note.startSec + note.durationSec), width - 8)
        ctx.fillRect(nx, ny - half * 0.35, Math.max(0, barEnd - nx), half * 0.7)
        ctx.globalAlpha = 1

        ctx.strokeStyle = STAFF_INK
        for (const ledger of ledgerSteps(step)) {
          ctx.beginPath()
          ctx.moveTo(nx - half * 1.8, Math.round(y(ledger)) + 0.5)
          ctx.lineTo(nx + half * 1.8, Math.round(y(ledger)) + 0.5)
          ctx.stroke()
        }

        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(-0.35)
        ctx.beginPath()
        ctx.ellipse(0, 0, half * 1.25, half * 0.85, 0, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        if (chordNotes.has(note.index) || sounding) {
          ctx.lineWidth = 1.5
          ctx.strokeStyle = chordNotes.has(note.index) ? CHORD_INK : '#ffffff'
          ctx.stroke()
        }
        ctx.restore()

        if (accidental) {
          ctx.fillStyle = INK
          ctx.font = `${Math.round(half * 2.6)}px serif`
          ctx.fillText(accidental, nx - half * 2.6, ny)
        }
      }

      if (log.notes.length === 0) {
        ctx.fillStyle = 'rgba(201, 214, 232, 0.7)'
        ctx.font = '14px system-ui, sans-serif'
        ctx.fillText('Press Play — notes will scroll across the staff', width / 2, y(MIDDLE_C_STEP))
      }

      if (playingRef.current) frame = requestAnimationFrame(draw)
    }

    draw()
    const unsubscribe = log.subscribe(() => {
      if (!playingRef.current) draw()
    })
    if (isPlaying) frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [canvasRef, size, log, isPlaying, colors])

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`Sheet music of the digits being played. ${summary}`}
    />
  )
}
