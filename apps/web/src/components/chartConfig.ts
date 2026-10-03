import type { ChartConfiguration, ChartType } from 'chart.js'
import { RAINBOW } from '../viz/palettes'

/** Chart styles offered in the UI. `horizontalBar` was a Chart.js 2 type; v4 uses `indexAxis`. */
export const CHART_STYLES = [
  { id: 'bar', label: 'Bar' },
  { id: 'horizontalBar', label: 'Horizontal bar' },
  { id: 'line', label: 'Line' },
  { id: 'polarArea', label: 'Polar area' },
  { id: 'doughnut', label: 'Doughnut' },
  { id: 'pie', label: 'Pie' },
  { id: 'radar', label: 'Radar' },
] as const

export type ChartStyle = (typeof CHART_STYLES)[number]['id']

export const DEFAULT_CHART_STYLE: ChartStyle = 'bar'

/** The original rainbow palette, one colour per digit 0–9. */
export const DIGIT_COLORS = RAINBOW

export const DIGIT_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/** Legacy animation length: one beat at 100 BPM minus a 1% buffer. */
export const CHART_ANIMATION_MS = 594

const CARTESIAN: ReadonlySet<ChartStyle> = new Set(['bar', 'horizontalBar', 'line'])

export const isCartesian = (style: ChartStyle) => CARTESIAN.has(style)

/**
 * Build a Chart.js config. On cartesian charts the value axis spans the current min..max count,
 * as in the original, which exaggerates the small differences between digit frequencies.
 */
export function buildChartConfig(
  style: ChartStyle,
  counts: readonly number[],
  textColor: string,
  gridColor: string,
  colors: readonly string[] = DIGIT_COLORS,
): ChartConfiguration {
  const type: ChartType = style === 'horizontalBar' ? 'bar' : style
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const valueAxis = {
    position: style === 'horizontalBar' ? ('bottom' as const) : ('right' as const),
    min,
    max: max === min ? min + 1 : max,
    ticks: { color: textColor, precision: 0 },
    grid: { color: gridColor },
  }
  const categoryAxis = { ticks: { color: textColor }, grid: { color: gridColor } }

  return {
    type,
    data: {
      labels: DIGIT_LABELS,
      datasets: [
        {
          label: 'Numbers of Pie',
          data: [...counts],
          backgroundColor: [...colors],
          borderColor: style === 'line' || style === 'radar' ? '#8fd3ff' : '#000',
          borderWidth: 1,
          pointBackgroundColor: [...colors],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: CHART_ANIMATION_MS },
      indexAxis: style === 'horizontalBar' ? 'y' : 'x',
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: isCartesian(style)
        ? style === 'horizontalBar'
          ? { x: valueAxis, y: categoryAxis }
          : { x: categoryAxis, y: valueAxis }
        : style === 'radar'
          ? {
              r: {
                ticks: { color: textColor, backdropColor: 'transparent', precision: 0 },
                grid: { color: gridColor },
                angleLines: { color: gridColor },
                pointLabels: { color: textColor },
              },
            }
          : style === 'polarArea'
            ? {
                r: {
                  ticks: { color: textColor, backdropColor: 'transparent', precision: 0 },
                  grid: { color: gridColor },
                },
              }
            : {},
    },
  } as ChartConfiguration
}

/** Apply new counts to an existing config in place (keeps Chart.js animations smooth). */
export function applyCounts(
  config: ChartConfiguration,
  style: ChartStyle,
  counts: readonly number[],
) {
  const dataset = config.data.datasets[0]
  if (dataset) dataset.data = [...counts]
  if (isCartesian(style)) {
    const axis = style === 'horizontalBar' ? config.options?.scales?.x : config.options?.scales?.y
    if (axis) {
      const min = Math.min(...counts)
      const max = Math.max(...counts)
      axis.min = min
      axis.max = max === min ? min + 1 : max
    }
  }
}

/** Legacy throttle: during the first 100 digits only redraw on even counts. */
export const shouldRedraw = (total: number) => total >= 100 || total % 2 === 0
