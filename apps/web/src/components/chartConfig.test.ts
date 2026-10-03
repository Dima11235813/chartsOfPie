import { describe, expect, it } from 'vitest'
import { applyCounts, buildChartConfig, CHART_STYLES, shouldRedraw } from './chartConfig'

const counts = [5, 9, 2, 7, 3, 4, 6, 8, 1, 0]

describe('chartConfig', () => {
  it('builds a config for every offered style', () => {
    for (const { id } of CHART_STYLES) {
      const config = buildChartConfig(id, counts, '#fff', '#333')
      expect(config.data.labels).toHaveLength(10)
      expect(config.data.datasets[0]?.data).toEqual(counts)
    }
  })

  it('maps horizontalBar onto a bar chart with a y index axis', () => {
    const config = buildChartConfig('horizontalBar', counts, '#fff', '#333')
    expect(config.type).toBe('bar')
    expect(config.options?.indexAxis).toBe('y')
    expect(config.options?.scales?.x?.min).toBe(0)
    expect(config.options?.scales?.x?.max).toBe(9)
  })

  it('scales the value axis to the min..max count like the original', () => {
    const config = buildChartConfig('bar', [3, 4, 5, 6, 7, 3, 4, 5, 6, 7], '#fff', '#333')
    expect(config.options?.scales?.y?.min).toBe(3)
    expect(config.options?.scales?.y?.max).toBe(7)
    applyCounts(config, 'bar', [10, 12, 11, 10, 10, 10, 10, 10, 10, 10])
    expect(config.options?.scales?.y?.min).toBe(10)
    expect(config.options?.scales?.y?.max).toBe(12)
    expect(config.data.datasets[0]?.data[1]).toBe(12)
  })

  it('never produces a zero-height axis', () => {
    const config = buildChartConfig('bar', new Array(10).fill(0), '#fff', '#333')
    expect(config.options?.scales?.y?.max).toBe(1)
  })

  it('keeps the legacy redraw throttle', () => {
    expect(shouldRedraw(1)).toBe(false)
    expect(shouldRedraw(2)).toBe(true)
    expect(shouldRedraw(99)).toBe(false)
    expect(shouldRedraw(101)).toBe(true)
  })
})
