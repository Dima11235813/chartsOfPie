import { describe, expect, it } from 'vitest'
import {
  colorFor,
  DEFAULT_RANGE,
  frequencyRow,
  logFrequencyRows,
  renderSpectrogram,
  rowFrequency,
  spectrumColumn,
} from './spectrogram'
import { ledgerSteps, staffPosition } from './staff'

describe('spectrogram maths', () => {
  it('maps the colour scale ends to dark and bright', () => {
    expect(colorFor(0)).toEqual([0, 0, 4])
    expect(colorFor(1)).toEqual([252, 253, 191])
    expect(colorFor(-5)).toEqual(colorFor(0))
    const mid = colorFor(0.5)
    expect(mid[0]).toBeGreaterThan(100)
  })

  it('uses a logarithmic frequency axis', () => {
    expect(rowFrequency(0, 101, DEFAULT_RANGE)).toBeCloseTo(10_000)
    expect(rowFrequency(100, 101, DEFAULT_RANGE)).toBeCloseTo(40)
    expect(rowFrequency(50, 101, DEFAULT_RANGE)).toBeCloseTo(Math.sqrt(40 * 10_000))
    expect(frequencyRow(rowFrequency(37, 200, DEFAULT_RANGE), 200, DEFAULT_RANGE)).toBeCloseTo(37)
  })

  it('covers every row with at least one FFT bin, low rows at low bins', () => {
    const rows = logFrequencyRows(120, 2048, 44100)
    expect(rows).toHaveLength(120)
    rows.forEach(([lo, hi]) => expect(hi).toBeGreaterThanOrEqual(lo))
    expect(rows[0]![1]).toBeGreaterThan(rows[119]![0])
    const column = spectrumColumn(
      Float32Array.from({ length: 2048 }, (_, i) => -i),
      rows,
    )
    expect(column[119]).toBeGreaterThan(column[0]!)
  })

  it('renders a 440 Hz sine as a bright band at the 440 Hz row', () => {
    const sampleRate = 44100
    const sine = Float32Array.from({ length: sampleRate }, (_, i) =>
      Math.sin((2 * Math.PI * 440 * i) / sampleRate),
    )
    const width = 8
    const height = 100
    const pixels = renderSpectrogram(sine, sampleRate, width, height)
    expect(pixels).toHaveLength(width * height * 4)
    const brightness = (y: number) =>
      pixels[(y * width + 3) * 4]! + pixels[(y * width + 3) * 4 + 1]!
    const row440 = Math.round(frequencyRow(440, height, DEFAULT_RANGE))
    const brightest = Array.from({ length: height }, (_, y) => brightness(y)).indexOf(
      Math.max(...Array.from({ length: height }, (_, y) => brightness(y))),
    )
    expect(Math.abs(brightest - row440)).toBeLessThanOrEqual(1)
  })
})

describe('staff geometry', () => {
  it('places notes by diatonic step with accidentals', () => {
    expect(staffPosition('C4')).toEqual({ step: 28, accidental: '' })
    expect(staffPosition('E4').step).toBe(30)
    expect(staffPosition('F#4')).toEqual({ step: 31, accidental: '♯' })
    expect(staffPosition('Bb3')).toEqual({ step: 27, accidental: '♭' })
    expect(staffPosition('A2').step).toBe(19)
    expect(() => staffPosition('H2')).toThrow()
  })

  it('adds ledger lines only outside the grand staff', () => {
    expect(ledgerSteps(28)).toEqual([28]) // middle C
    expect(ledgerSteps(29)).toEqual([]) // D4 hangs below the treble staff
    expect(ledgerSteps(27)).toEqual([]) // B3 sits above the bass staff
    expect(ledgerSteps(34)).toEqual([]) // B4, on the staff
    expect(ledgerSteps(40)).toEqual([40]) // A5
    expect(ledgerSteps(43)).toEqual([40, 42]) // D6
    expect(ledgerSteps(16)).toEqual([16]) // E2
    expect(ledgerSteps(13)).toEqual([16, 14]) // B1
  })
})
