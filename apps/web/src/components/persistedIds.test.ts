import {
  CHART_STYLE_IDS,
  DEFAULT_VISUAL_CONFIG,
  PALETTE_IDS,
  VIEW_IDS,
  visualConfigSchema,
} from '../core/piece/visualConfig'
import { TUNINGS } from '../viz/fretboard'
import { PALETTES } from '../viz/palettes'
import { CHART_STYLES } from './chartConfig'
import { VIEWS } from './views'

// Persisted ids (core/piece/visualConfig) and the UI lists must offer exactly the same choices.
test('UI choices match the persisted ids', () => {
  expect(VIEWS.map((v) => v.id).sort()).toEqual([...VIEW_IDS].sort())
  expect(PALETTES.map((p) => p.id).sort()).toEqual([...PALETTE_IDS].sort())
  expect(CHART_STYLES.map((c) => c.id).sort()).toEqual([...CHART_STYLE_IDS].sort())
  for (const { id } of TUNINGS) {
    const parsed = visualConfigSchema.parse({
      ...DEFAULT_VISUAL_CONFIG,
      viewOptions: { ...DEFAULT_VISUAL_CONFIG.viewOptions, fretboard: { tuning: id } },
    })
    expect(parsed.viewOptions.fretboard.tuning).toBe(id)
  }
})
