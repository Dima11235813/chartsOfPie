import { useRef, useState } from 'react'
import type { PerformanceLog } from '../../core/composition/performanceLog'
import type { DigitSource } from '../../core/digits/digitSource'
import { ART, type ArtKind } from '../../viz/render/registry'
import type { DigitRenderer } from '../../viz/render/renderer'
import { useDigitColors } from '../palette'
import { useCanvas } from './useCanvas'
import { useDigitFeed } from './useDigitFeed'

interface DigitArtViewProps {
  kind: ArtKind
  source: DigitSource
  log: PerformanceLog
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

/**
 * A growing artwork driven by the digits as they play (digit ring, π walk, sunflower, mosaic).
 * Drawing lives in the renderer (viz/render), shared with posters; this component only feeds it
 * digits once per animation frame and rebuilds it on reset, resize or palette change.
 */
export function DigitArtView({ kind, source, log, onCanvas }: DigitArtViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const colors = useDigitColors()
  const definition = ART[kind]
  const renderer = useRef<DigitRenderer | null>(null)
  const [summary, setSummary] = useState('No digits yet.')

  const compose = () => {
    const canvas = canvasRef.current
    if (!canvas || !renderer.current) return
    const chord = log.chords.at(-1)
    const chordDigits =
      chord && log.lastStep && chord.index === log.lastStep.index
        ? new Set(chord.notes.map((note) => note.digit))
        : undefined
    renderer.current.compose(canvas.getContext('2d')!, { highlight: true, chordDigits })
  }

  useDigitFeed(log, `${kind}:${size.width}x${size.height}:${colors.join()}`, {
    reset() {
      const canvas = canvasRef.current
      if (!canvas || size.width === 0) return
      renderer.current = definition.live({
        width: canvas.width,
        height: canvas.height,
        scale: size.ratio,
        colors,
      })
      compose()
      setSummary('No digits yet.')
    },
    draw(from, to) {
      if (!renderer.current) return
      renderer.current.draw(from, to, (i) => source.digitAt(i))
      compose()
      setSummary(definition.summary(to))
    },
  })

  return (
    <canvas
      ref={ref}
      className="viz-canvas"
      role="img"
      aria-label={`${definition.describe} ${summary}`}
    />
  )
}
