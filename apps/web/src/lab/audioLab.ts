/**
 * Audio lab: a tiny page (audio-lab.html) exposing deterministic offline renders to Playwright —
 * the spectrogram snapshot tests (e2e/audio-snapshots.spec.ts) and the listening harness
 * (scripts/render-presets.spec.ts) — and to humans via a "Render all" button.
 */
import { analyse, encodeWav, mixToMono, type AudioStats } from '../audio/analysis'
import { INSTRUMENTS } from '../audio/instruments'
import { renderConfig } from '../audio/offlineRender'
import type { CompositionConfig } from '../core/composition/config'
import { getPreset, PRESETS } from '../core/composition/presets'
import { loadPiDigits } from '../core/digits/pi'
import type { DigitSource } from '../core/digits/digitSource'
import { seededRandom } from '../core/random/seededRandom'
import { renderSpectrogram } from '../viz/spectrogram'

export interface LabRenderOptions {
  seconds?: number
  seed?: number
  start?: number
  /** Include the WAV file (base64); large, so off by default. */
  wav?: boolean
  spectrogramWidth?: number
  spectrogramHeight?: number
}

export interface LabRenderResult {
  id: string
  name: string
  notes: number
  stats: AudioStats
  /** PNG data URL of the spectrogram. */
  spectrogram: string
  wavBase64?: string
}

let source: Promise<DigitSource> | null = null
const digits = () => (source ??= loadPiDigits())

/**
 * Tone.js fills noise buffers (reverb impulse responses) with Math.random, so seed it for the
 * duration of a render to make output bit-for-bit repeatable.
 */
async function withSeededRandom<T>(seed: number, run: () => Promise<T>): Promise<T> {
  const original = Math.random
  Math.random = seededRandom(seed ^ 0x5eed)
  try {
    return await run()
  } finally {
    Math.random = original
  }
}

function spectrogramDataUrl(
  channels: Float32Array[],
  sampleRate: number,
  width: number,
  height: number,
) {
  const pixels = renderSpectrogram(mixToMono(channels), sampleRate, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export async function render(
  idOrConfig: string | { id: string; name: string; config: CompositionConfig },
  options: LabRenderOptions = {},
): Promise<LabRenderResult> {
  const { seconds = 8, seed = 1, start = 0, wav = false } = options
  const job =
    typeof idOrConfig === 'string'
      ? (() => {
          const preset = getPreset(idOrConfig)
          if (!preset) throw new Error(`Unknown preset: ${idOrConfig}`)
          return preset
        })()
      : idOrConfig
  const result = await withSeededRandom(seed, async () =>
    renderConfig(job.config, await digits(), { seconds, seed, startIndex: start }),
  )
  return {
    id: job.id,
    name: job.name,
    notes: result.notes,
    stats: analyse(result.channels, result.sampleRate),
    spectrogram: spectrogramDataUrl(
      result.channels,
      result.sampleRate,
      options.spectrogramWidth ?? 640,
      options.spectrogramHeight ?? 200,
    ),
    wavBase64: wav ? toBase64(encodeWav(result.channels, result.sampleRate)) : undefined,
  }
}

/**
 * Tone's very first reverb impulse in a page renders slightly differently from every later one, so
 * warm up once before anyone renders for comparison.
 */
const ready: Promise<void> = (async () => {
  const warm = getPreset('pentatonic-piano')!
  await render({ ...warm, config: { ...warm.config, instrument: 'pure-sine' } }, { seconds: 1 })
})()

const lab = {
  presetIds: PRESETS.map((p) => p.id),
  instruments: INSTRUMENTS.map(({ id, name }) => ({ id, name })),
  presetConfig: (id: string) => getPreset(id)?.config ?? null,
  render,
  ready,
}
declare global {
  interface Window {
    audioLab: typeof lab
  }
}
window.audioLab = lab

document.getElementById('render')?.addEventListener('click', async () => {
  const out = document.getElementById('out')!
  out.textContent = 'Rendering…'
  const items: string[] = []
  for (const id of lab.presetIds) {
    const r = await render(id)
    items.push(
      `<h2>${r.name}</h2><p>${r.notes} notes · loudness ${r.stats.loudnessDb.toFixed(1)} dB · peak ${r.stats.peakDb.toFixed(1)} dBFS</p><img alt="Spectrogram of ${r.name}" src="${r.spectrogram}">`,
    )
    out.innerHTML = items.join('')
  }
})
