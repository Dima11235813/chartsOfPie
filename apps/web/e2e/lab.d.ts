/** Shapes of `window.audioLab` and `window.posterLab` (src/lab/) as used by the tests. */
interface AudioLabResult {
  id: string
  name: string
  notes: number
  stats: {
    peakDb: number
    rmsDb: number
    loudnessDb: number
    maxMomentaryDb: number
    clippedSamples: number
    centroidHz: number
    highBandRatio: number
  }
  spectrogram: string
  wavBase64?: string
}

interface Window {
  posterLab: {
    kinds: string[]
    render(
      kind: string,
      options?: {
        count?: number
        size?: number
        palette?: string
        series?: string
        reading?: string
      },
    ): Promise<string>
  }
  audioLab: {
    presetIds: string[]
    instruments: { id: string; name: string }[]
    presetConfig(id: string): unknown
    ready: Promise<void>
    render(
      idOrJob: string | { id: string; name: string; config: unknown },
      options?: { seconds?: number; seed?: number; start?: number; wav?: boolean },
    ): Promise<AudioLabResult>
  }
}
