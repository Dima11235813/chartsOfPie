import { fft } from '../audio/analysis'

/**
 * Spectrogram maths shared by the live view (Web Audio AnalyserNode) and the offline snapshot
 * renderer used by the audio regression tests, so both draw identical colours and frequency axes.
 */

/** Magma-like perceptually uniform colour map (dark → bright), 9 stops. */
const STOPS: readonly (readonly [number, number, number])[] = [
  [0, 0, 4],
  [28, 16, 68],
  [79, 18, 123],
  [129, 37, 129],
  [181, 54, 122],
  [229, 80, 100],
  [251, 135, 97],
  [254, 194, 135],
  [252, 253, 191],
]

/** Colour for a value in [0, 1] (clamped). */
export function colorFor(value: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, value)) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(t))
  const f = t - i
  const a = STOPS[i]!
  const b = STOPS[i + 1]!
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}

export interface SpectrogramRange {
  minHz: number
  maxHz: number
  minDb: number
  maxDb: number
}

export const DEFAULT_RANGE: SpectrogramRange = { minHz: 40, maxHz: 10_000, minDb: -100, maxDb: -20 }

export const dbToUnit = (db: number, { minDb, maxDb }: SpectrogramRange) =>
  (db - minDb) / (maxDb - minDb)

/** Frequency shown at pixel row `y` (0 = top) on a logarithmic axis. */
export function rowFrequency(
  y: number,
  height: number,
  { minHz, maxHz }: SpectrogramRange,
): number {
  const fromBottom = (height - 1 - y) / Math.max(1, height - 1)
  return minHz * Math.pow(maxHz / minHz, fromBottom)
}

/** Pixel row of a frequency (inverse of `rowFrequency`). */
export function frequencyRow(
  hz: number,
  height: number,
  { minHz, maxHz }: SpectrogramRange,
): number {
  const fromBottom = Math.log(hz / minHz) / Math.log(maxHz / minHz)
  return height - 1 - fromBottom * (height - 1)
}

/**
 * For each pixel row (top → bottom), the inclusive FFT bin range it covers on a log axis. Low rows
 * span less than one bin, so ranges always contain at least one bin.
 */
export function logFrequencyRows(
  height: number,
  binCount: number,
  sampleRate: number,
  range: SpectrogramRange = DEFAULT_RANGE,
): [number, number][] {
  const binHz = sampleRate / 2 / binCount
  const edge = (y: number) => rowFrequency(y, height, range)
  return Array.from({ length: height }, (_, y) => {
    const high = y === 0 ? range.maxHz : Math.sqrt(edge(y) * edge(y - 1))
    const low = y === height - 1 ? range.minHz : Math.sqrt(edge(y) * edge(y + 1))
    const lo = Math.min(binCount - 1, Math.max(0, Math.round(low / binHz)))
    const hi = Math.min(binCount - 1, Math.max(lo, Math.round(high / binHz)))
    return [lo, hi] as [number, number]
  })
}

/** Loudest dB per row from a dB spectrum (as from `AnalyserNode.getFloatFrequencyData`). */
export function spectrumColumn(spectrumDb: ArrayLike<number>, rows: readonly [number, number][]) {
  return Float32Array.from(rows, ([lo, hi]) => {
    let max = -Infinity
    for (let bin = lo; bin <= hi; bin++) max = Math.max(max, spectrumDb[bin]!)
    return max
  })
}

/**
 * Render a whole signal as an RGBA spectrogram image (width × height), offline. Uses a Hann window
 * and reports levels in dBFS of a full-scale sine, like the AnalyserNode does.
 */
export function renderSpectrogram(
  mono: Float32Array,
  sampleRate: number,
  width: number,
  height: number,
  { fftSize = 4096, range = DEFAULT_RANGE }: { fftSize?: number; range?: SpectrogramRange } = {},
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const bins = fftSize / 2
  const rows = logFrequencyRows(height, bins, sampleRate, range)
  const hop = Math.max(1, (mono.length - fftSize) / Math.max(1, width - 1))
  const re = new Float64Array(fftSize)
  const im = new Float64Array(fftSize)
  const spectrum = new Float32Array(bins)
  const window = Float64Array.from(
    { length: fftSize },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)),
  )
  for (let x = 0; x < width; x++) {
    const start = Math.min(Math.round(x * hop), Math.max(0, mono.length - fftSize))
    for (let i = 0; i < fftSize; i++) {
      re[i] = (mono[start + i] ?? 0) * window[i]!
      im[i] = 0
    }
    fft(re, im)
    for (let bin = 0; bin < bins; bin++) {
      const magnitude = (2 * Math.hypot(re[bin]!, im[bin]!)) / (fftSize * 0.5)
      spectrum[bin] = magnitude > 0 ? 20 * Math.log10(magnitude) : -Infinity
    }
    const column = spectrumColumn(spectrum, rows)
    for (let y = 0; y < height; y++) {
      const [r, g, b] = colorFor(dbToUnit(column[y]!, range))
      const offset = (y * width + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = 255
    }
  }
  return pixels
}
