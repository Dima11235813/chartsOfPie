import { useEffect, useRef } from 'react'
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import { applyCounts, buildChartConfig, shouldRedraw, type ChartStyle } from './chartConfig'

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  Tooltip,
)

interface DigitChartProps {
  style: ChartStyle
  counts: readonly number[]
  total: number
  /** Told which canvas is on screen (for video recording and image export). */
  onCanvas?: (canvas: HTMLCanvasElement | null) => void
}

const TEXT_COLOR = '#c9d6e8'
const GRID_COLOR = 'rgba(201, 214, 232, 0.15)'

export function DigitChart({ style, counts, total, onCanvas }: DigitChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const countsRef = useRef(counts)
  const onCanvasRef = useRef(onCanvas)

  useEffect(() => {
    onCanvasRef.current = onCanvas
  })

  useEffect(() => {
    onCanvasRef.current?.(canvasRef.current)
    return () => onCanvasRef.current?.(null)
  }, [])

  // Keep the latest counts available to the chart-creation effect without re-running it.
  useEffect(() => {
    countsRef.current = counts
  })

  // (Re)create the chart only when the style changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const config = buildChartConfig(style, countsRef.current, TEXT_COLOR, GRID_COLOR)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && config.options) {
      config.options.animation = false
    }
    const chart = new Chart(canvas, config)
    chartRef.current = chart
    return () => {
      chart.destroy()
      chartRef.current = null
    }
  }, [style])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    applyCounts(chart.config as Parameters<typeof applyCounts>[0], style, counts)
    if (total === 0 || shouldRedraw(total)) chart.update()
  }, [counts, total, style])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${style} chart of how often each digit 0 to 9 has appeared: ${counts
        .map((c, d) => `${d}: ${c}`)
        .join(', ')}`}
    />
  )
}
