/** Visualizations the stage can show (analytical first, then the artistic gallery — R-006). */
export const VIEWS = [
  { id: 'chart', label: 'Digit chart' },
  { id: 'staff', label: 'Sheet music' },
  { id: 'spectrogram', label: 'Spectrogram' },
  { id: 'ring', label: 'Digit ring' },
  { id: 'walk', label: 'π walk' },
  { id: 'sunflower', label: 'Sunflower' },
  { id: 'mosaic', label: 'Neighbour mosaic' },
  { id: 'clock', label: 'Music clock' },
  { id: 'strings', label: 'String art' },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

export const isViewId = (value: string): value is ViewId => VIEWS.some((v) => v.id === value)
