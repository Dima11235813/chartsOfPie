import { useEffect, useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { stringArtMultiplier } from '../../viz/art'
import { drawStringArt, STRING_ART_POINTS } from '../../viz/render/stringArtRenderer'
import { useDigitColors } from '../palette'
import { prefersReducedMotion, useCanvas } from './useCanvas'

interface StringArtViewProps {
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/** How quickly the shape eases towards the latest multiplier (per frame at 60 fps). */
const EASING = 0.04

/**
 * Times-table string art: strings from n to k·n mod 240, with k set by the latest two digits
 * (2 + d₁ + d₂/10). The figure eases from one multiplier to the next, so cardioids, nephroids and
 * their relatives morph into each other as π plays; chords that form make it glow.
 */
export function StringArtView({ source, log, onCanvas }: StringArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const target = useRef(2)
  const current = useRef(2)
  const glow = useRef(0)
  const [summary, setSummary] = useState('k = 2: the cardioid.')

  useEffect(() => {
    const update = () => {
      const count = log.stepCount
      if (count === 0) {
        target.current = 2
        return
      }
      const previous = count >= 2 ? source.digitAt(count - 2) : 0
      target.current = stringArtMultiplier(previous, source.digitAt(count - 1))
      const chord = log.chords.at(-1)
      if (chord && log.lastStep && chord.index === log.lastStep.index) glow.current = 1
      setSummary(
        `k = ${target.current.toFixed(1)} from the digits ${previous}${source.digitAt(count - 1)}.`,
      )
    }
    update()
    return log.subscribe(update)
  }, [log, source])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const reduced = prefersReducedMotion()
    let frame = 0
    const draw = () => {
      const k = current.current
      current.current = reduced ? target.current : k + (target.current - k) * EASING
      glow.current *= 0.94
      drawStringArt(ctx, canvas.width, canvas.height, size.ratio, {
        multiplier: current.current,
        colors,
        glow: glow.current,
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, size, colors])

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`Times-table string art: ${STRING_ART_POINTS} points on a circle, each joined to k times itself modulo ${STRING_ART_POINTS}. ${summary}`}
    />
  )
}
