/** Pure DSP helpers for judging renders objectively (no Web Audio needed). */

export interface AudioStats {
  /** Highest absolute sample, dBFS. */
  peakDb: number
  /** RMS over the whole render, dBFS. */
  rmsDb: number
  /** Loudest 400 ms window RMS, dBFS (a rough "momentary loudness"). */
  maxMomentaryDb: number
  /**
   * Gated loudness, dBFS: mean power of 400 ms blocks after an absolute gate at -70 dB and a
   * relative gate 10 dB below the ungated mean — the gating scheme of ITU-R BS.1770, without the
   * K-weighting filter. Silence and rests don't drag it down, so sparse and dense presets compare.
   */
  loudnessDb: number
  /** Samples at or above 0.999 full scale. */
  clippedSamples: number
  /** Average spectral centroid in Hz — higher sounds brighter/harsher. */
  centroidHz: number
  /** Share of spectral energy above 4 kHz, 0–1. */
  highBandRatio: number
}

const toDb = (value: number) => (value <= 0 ? -Infinity : 20 * Math.log10(value))

/** Average the channels into one mono signal. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i]! += channel[i]! / channels.length
  }
  return mono
}

/** In-place iterative radix-2 FFT. `re` and `im` length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j]!, re[i]!]
      ;[im[i], im[j]] = [im[j]!, im[i]!]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const cos = Math.cos(angle * k)
        const sin = Math.sin(angle * k)
        const a = start + k
        const b = a + size / 2
        const tre = re[b]! * cos - im[b]! * sin
        const tim = re[b]! * sin + im[b]! * cos
        re[b] = re[a]! - tre
        im[b] = im[a]! - tim
        re[a] = re[a]! + tre
        im[a] = im[a]! + tim
      }
    }
  }
}

export function analyse(channels: readonly Float32Array[], sampleRate: number): AudioStats {
  let peak = 0
  let clipped = 0
  let sumSquares = 0
  let samples = 0
  for (const channel of channels) {
    for (const value of channel) {
      const magnitude = Math.abs(value)
      if (magnitude > peak) peak = magnitude
      if (magnitude >= 0.999) clipped++
      sumSquares += value * value
      samples++
    }
  }

  const mono = mixToMono(channels)
  const length = channels[0]?.length ?? 0
  const window = Math.round(sampleRate * 0.4)
  const blockPowers: number[] = []
  // Per-channel power, averaged (BS.1770 sums channel powers rather than downmixing, so wide
  // stereo sources such as the sampled piano are not under-measured).
  for (let start = 0; start + window <= length; start += Math.round(window / 4)) {
    let sum = 0
    for (const channel of channels) {
      for (let i = start; i < start + window; i++) sum += channel[i]! * channel[i]!
    }
    blockPowers.push(sum / window / channels.length)
  }
  const maxMomentary = Math.sqrt(Math.max(0, ...blockPowers))
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
  const absoluteGated = blockPowers.filter((p) => p > 1e-7) // -70 dB
  const relativeGate = mean(absoluteGated) * 0.1 // -10 dB
  const gated = absoluteGated.filter((p) => p > relativeGate)
  const loudness = Math.sqrt(mean(gated))

  const frame = 2048
  let weightedFrequency = 0
  let totalEnergy = 0
  let highEnergy = 0
  const re = new Float64Array(frame)
  const im = new Float64Array(frame)
  for (let start = 0; start + frame <= mono.length; start += frame * 2) {
    for (let i = 0; i < frame; i++) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1))
      re[i] = mono[start + i]! * hann
      im[i] = 0
    }
    fft(re, im)
    for (let bin = 1; bin < frame / 2; bin++) {
      const energy = re[bin]! * re[bin]! + im[bin]! * im[bin]!
      const frequency = (bin * sampleRate) / frame
      weightedFrequency += frequency * energy
      totalEnergy += energy
      if (frequency > 4000) highEnergy += energy
    }
  }

  return {
    peakDb: toDb(peak),
    rmsDb: toDb(Math.sqrt(sumSquares / Math.max(1, samples))),
    maxMomentaryDb: toDb(maxMomentary),
    loudnessDb: toDb(loudness),
    clippedSamples: clipped,
    centroidHz: totalEnergy === 0 ? 0 : weightedFrequency / totalEnergy,
    highBandRatio: totalEnergy === 0 ? 0 : highEnergy / totalEnergy,
  }
}

/** 16-bit PCM WAV file. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const length = channels[0]?.length ?? 0
  const channelCount = channels.length
  const dataBytes = length * channelCount * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channelCount * 2, true)
  view.setUint16(32, channelCount * 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[i]!))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Uint8Array(buffer)
}
