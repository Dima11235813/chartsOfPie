import { CHART_STYLE_IDS, PALETTE_IDS, VIEW_IDS } from '../core/piece/visualConfig'
import { PALETTES } from '../viz/palettes'
import { CHART_STYLES } from './chartConfig'
import { VIEWS } from './views'

// Persisted ids (core/piece/visualConfig) and the UI lists must offer exactly the same choices.
test('UI choices match the persisted ids', () => {
  expect(VIEWS.map((v) => v.id).sort()).toEqual([...VIEW_IDS].sort())
  expect(PALETTES.map((p) => p.id).sort()).toEqual([...PALETTE_IDS].sort())
  expect(CHART_STYLES.map((c) => c.id).sort()).toEqual([...CHART_STYLE_IDS].sort())
})
