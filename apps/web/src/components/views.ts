/** Visualizations the stage can show. */
export const VIEWS = [
  { id: 'chart', label: 'Digit chart' },
  { id: 'staff', label: 'Sheet music' },
  { id: 'spectrogram', label: 'Spectrogram' },
] as const

export type ViewId = (typeof VIEWS)[number]['id']
