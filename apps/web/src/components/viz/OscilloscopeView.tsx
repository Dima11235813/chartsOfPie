import { useEffect, useRef } from 'react'
import type { WaveformSource } from '../../audio/notePlayer'
import { useCanvas } from './useCanvas'

interface OscilloscopeViewProps {
  /** Stereo time-domain samples of the output, or null before audio has started. */
  waveform: WaveformSource | null
  isPlaying: boolean
  /** Colour of the trace (the current digit's colour). */
  color: string
  mode: ScopeMode
  onModeChange: (mode: ScopeMode) => void
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

export type ScopeMode = 'vector' | 'wave'

const TAIL_MS = 3000

/**
 * Oscilloscope of the actual audio output with phosphor-style persistence.
 * - Vectorscope (default): left vs right channel rotated 45°, so mono sound is a vertical line and
 *   stereo width (reverb, the piano's two microphones) blooms sideways into shapes.
 * - Waveform: both channels against time, triggered on a rising zero crossing so it stands still.
 */
export function OscilloscopeView({
  waveform,
  isPlaying,
  color,
  mode,
  onModeChange,
  onCanvas,
}: OscilloscopeViewProps) {
  const { ref, canvasRef, size } = useCanvas(onCanvas)
  const stopAt = useRef(0)
  const colorRef = useRef(color)

  useEffect(() => {
    colorRef.current = color
  })

  useEffect(() => {
    stopAt.current = isPlaying ? Infinity : performance.now() + TAIL_MS
  }, [isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const scale = size.ratio
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    if (!waveform) return
    const left = new Float32Array(waveform.size)
    const right = new Float32Array(waveform.size)
    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)
      if (performance.now() > stopAt.current) return
      waveform.read(left, right)
      // Phosphor persistence: fade earlier frames towards transparent instead of clearing.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      ctx.beginPath()
      if (mode === 'vector') {
        const cx = w / 2
        const cy = h / 2
        const gain = Math.min(w, h) * 0.9
        // At most ~512 points per trace: the screen can't show more, and stroking 2,048 was costly.
        const stride = Math.max(1, Math.floor(left.length / 512))
        for (let i = 0; i < left.length; i += stride) {
          const side = (left[i]! - right[i]!) * Math.SQRT1_2
          const mid = (left[i]! + right[i]!) * Math.SQRT1_2
          const x = cx + side * gain
          const y = cy - mid * gain
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      } else {
        // Trigger: first rising zero crossing in the first half of the buffer.
        let start = 0
        for (let i = 1; i < left.length / 2; i++) {
          if (left[i - 1]! < 0 && left[i]! >= 0) {
            start = i
            break
          }
        }
        const span = left.length / 2
        const stride = Math.max(1, Math.floor(span / 512))
        const trace = (data: Float32Array, centre: number) => {
          for (let i = 0; i < span; i += stride) {
            const x = (i / span) * w
            const y = centre - data[start + i]! * h * 0.4
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
        }
        trace(left, h * 0.3)
        trace(right, h * 0.72)
      }
      // Glow without shadowBlur (which re-blurs the whole path every frame): a wide faint stroke
      // under a thin bright one.
      ctx.strokeStyle = colorRef.current
      ctx.globalAlpha = 0.25
      ctx.lineWidth = 4 * scale
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.4 * scale
      ctx.stroke()
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, size, waveform, mode])

  return (
    <div className="viz-layer">
      <canvas
        ref={ref}
        className="viz-canvas"
        role="img"
        aria-label={
          mode === 'vector'
            ? 'Oscilloscope (vectorscope): left against right channel; mono sound is a vertical line, stereo spreads sideways.'
            : 'Oscilloscope (waveform): left and right channels over time.'
        }
      />
      <label className="viz-toggle">
        <input
          type="checkbox"
          checked={mode === 'wave'}
          onChange={(e) => onModeChange(e.target.checked ? 'wave' : 'vector')}
        />
        Waveform
      </label>
      {!waveform && <p className="viz-placeholder">Press Play to see the sound.</p>}
    </div>
  )
}
