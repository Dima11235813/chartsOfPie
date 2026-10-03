import type { VisualConfig } from '../core/piece/visualConfig'

/** Visualizations the stage can show, grouped in the View selector (see R-006). */
export const VIEWS = [
  { id: 'chart', label: 'Digit chart', group: 'Analytical' },
  { id: 'staff', label: 'Sheet music', group: 'Analytical' },
  { id: 'spectrogram', label: 'Spectrogram', group: 'Analytical' },
  { id: 'ring', label: 'Digit ring', group: 'Artistic' },
  { id: 'walk', label: 'π walk', group: 'Artistic' },
  { id: 'sunflower', label: 'Sunflower', group: 'Artistic' },
  { id: 'mosaic', label: 'Neighbour mosaic', group: 'Artistic' },
  { id: 'hilbert', label: 'Hilbert carpet', group: 'Artistic' },
  { id: 'type', label: 'Typographic π', group: 'Artistic' },
  { id: 'strings', label: 'String art', group: 'Artistic' },
  { id: 'clock', label: 'Music clock', group: 'Sound shapes' },
  { id: 'harmonograph', label: 'Harmonograph', group: 'Sound shapes' },
  { id: 'scope', label: 'Oscilloscope', group: 'Sound shapes' },
] as const satisfies readonly { id: ViewId; label: string; group: string }[]

/** View ids are persisted (links, saved pieces): the list lives in core/piece/visualConfig. */
export type ViewId = VisualConfig['view']

export const VIEW_GROUPS = [...new Set(VIEWS.map((v) => v.group))]

export const isViewId = (value: string): value is ViewId => VIEWS.some((v) => v.id === value)
