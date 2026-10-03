import { describe, expect, it } from 'vitest'
import { analyse, encodeWav, fft } from './analysis'

const sine = (frequency: number, amplitude: number, seconds = 1, sampleRate = 44100) =>
  Float32Array.from(
    { length: seconds * sampleRate },
    (_, i) => amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate),
  )

describe('analysis', () => {
  it('measures a sine wave', () => {
    const stats = analyse([sine(440, 0.5)], 44100)
    expect(stats.peakDb).toBeCloseTo(-6.02, 1)
    expect(stats.rmsDb).toBeCloseTo(-9.03, 1)
    expect(stats.clippedSamples).toBe(0)
    expect(stats.loudnessDb).toBeCloseTo(-9.03, 1)
    expect(stats.centroidHz).toBeGreaterThan(400)
    expect(stats.centroidHz).toBeLessThan(500)
    expect(stats.highBandRatio).toBeLessThan(0.01)
  })

  it('detects clipping and brightness', () => {
    const bright = analyse([sine(6000, 1)], 44100)
    expect(bright.clippedSamples).toBeGreaterThan(0)
    expect(bright.highBandRatio).toBeGreaterThan(0.9)
  })

  it('gated loudness ignores silent stretches', () => {
    const tone = sine(440, 0.5, 1)
    const sparse = new Float32Array(44100 * 4)
    sparse.set(tone, 0)
    const stats = analyse([sparse], 44100)
    expect(stats.rmsDb).toBeLessThan(-14)
    expect(stats.loudnessDb).toBeGreaterThan(-10)
  })

  it('handles silence', () => {
    const stats = analyse([new Float32Array(44100)], 44100)
    expect(stats.peakDb).toBe(-Infinity)
    expect(stats.centroidHz).toBe(0)
  })

  it('fft finds the bin of a pure tone', () => {
    const n = 64
    const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 4 * i) / n))
    const im = new Float64Array(n)
    fft(re, im)
    const magnitudes = Array.from(re, (r, i) => Math.hypot(r, im[i]!))
    expect(magnitudes.indexOf(Math.max(...magnitudes))).toBe(4)
  })

  it('writes a valid 16-bit WAV header', () => {
    const wav = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, 0.5, -0.5])], 8000)
    const view = new DataView(wav.buffer)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(8000)
    expect(view.getUint32(40, true)).toBe(12)
    expect(view.getInt16(48, true)).toBe(0x7fff) // interleaved: L0 R0 L1…
    expect(view.getInt16(52, true)).toBe(-0x8000)
    expect(wav.length).toBe(56)
  })
})
