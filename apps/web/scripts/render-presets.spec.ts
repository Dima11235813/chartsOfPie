/**
 * Listening harness: renders presets offline in Chromium with the exact live audio graph (via the
 * audio lab page, src/lab/audioLab.ts), writes WAV files, spectrogram PNGs and a loudness/brightness
 * report to apps/web/audio-renders/ (git-ignored).
 *
 *   npm run audio:render                          # all presets
 *   PRESETS=lydian-dream,music-box npm run audio:render
 *   SECONDS=40 SEED=3 START=1000 npm run audio:render
 *   CALIBRATE=1 npm run audio:render              # same phrase on every instrument → trims
 *
 * Fails if anything clips, or a preset's gated loudness is outside the target window.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const OUT = join(import.meta.dirname, '..', 'audio-renders')
const SECONDS = Number(process.env.SECONDS ?? 20)
const SEED = Number(process.env.SEED ?? 1)
const START = Number(process.env.START ?? 0)
const CALIBRATE = Boolean(process.env.CALIBRATE)
/** Every preset is loudness-matched to Original (≈ -13.5 dB) so comparisons are fair. */
const TARGET_LOUDNESS_DB = -14
const LOUDNESS_WINDOW_DB = 1.5
/** Calibration phrase target: what each bare instrument should measure. */
const CALIBRATION_TARGET_DB = -20

interface Row {
  id: string
  name: string
  notes: number
  peakDb: number
  rmsDb: number
  loudnessDb: number
  maxMomentaryDb: number
  clippedSamples: number
  centroidHz: number
  highBandRatio: number
  wavBase64: string
  /** PNG data URL. */
  spectrogram: string
}

test('render presets', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  await page.goto('/audio-lab.html')
  await page.waitForFunction(() => window.audioLab !== undefined)
  const only = process.env.PRESETS?.split(',').filter(Boolean) ?? []

  const rows: Row[] = await page.evaluate(
    async ({ seconds, seed, start, only, calibrate }) => {
      const lab = window.audioLab
      await lab.ready
      type Job = string | { id: string; name: string; config: unknown }
      let jobs: Job[]
      if (calibrate) {
        // Neutral phrase: steady eighths at 100 BPM, dry, flat dynamics, original scale.
        const neutral = {
          ...(lab.presetConfig('original') as object),
          timing: 'tempo',
          rhythm: 'steady',
          bpm: 100,
          subdivision: 2,
          legato: 1,
        }
        jobs = lab.instruments.map((i) => ({
          id: `instrument-${i.id}`,
          name: i.name,
          config: { ...neutral, instrument: i.id },
        }))
      } else {
        jobs = lab.presetIds.filter((id) => !only.length || only.includes(id) || id === 'original')
      }

      const out = []
      for (const job of jobs) {
        const r = await lab.render(job, { seconds, seed, start, wav: true })
        out.push({
          id: r.id,
          name: r.name,
          notes: r.notes,
          ...r.stats,
          wavBase64: r.wavBase64!,
          spectrogram: r.spectrogram,
        })
      }
      return out
    },
    { seconds: SECONDS, seed: SEED, start: START, only, calibrate: CALIBRATE },
  )

  mkdirSync(OUT, { recursive: true })
  const lines = [
    CALIBRATE
      ? `# Instrument calibration — neutral phrase, ${SECONDS}s, target ${CALIBRATION_TARGET_DB} dB`
      : `# Preset renders — ${SECONDS}s from digit ${START} of π, seed ${SEED}, target ${TARGET_LOUDNESS_DB} ±${LOUDNESS_WINDOW_DB} dB`,
    '',
    `| ${CALIBRATE ? 'Instrument' : 'Preset'} | Notes | Peak dBFS | Gated loudness dB | RMS dBFS | Max 400 ms dB | Clipped | Centroid Hz | >4 kHz |${CALIBRATE ? ' Trim change dB |' : ''}`,
    `| --- | --: | --: | --: | --: | --: | --: | --: | --: |${CALIBRATE ? ' --: |' : ''}`,
  ]
  for (const row of rows) {
    writeFileSync(join(OUT, `${row.id}.wav`), Buffer.from(row.wavBase64, 'base64'))
    writeFileSync(
      join(OUT, `${row.id}.spectrogram.png`),
      Buffer.from(row.spectrogram.split(',')[1]!, 'base64'),
    )
    const trim = CALIBRATE ? ` ${(CALIBRATION_TARGET_DB - row.loudnessDb).toFixed(1)} |` : ''
    lines.push(
      `| ${row.name} | ${row.notes} | ${row.peakDb.toFixed(1)} | ${row.loudnessDb.toFixed(1)} | ${row.rmsDb.toFixed(1)} | ${row.maxMomentaryDb.toFixed(1)} | ${row.clippedSamples} | ${Math.round(row.centroidHz)} | ${(row.highBandRatio * 100).toFixed(1)}% |${trim}`,
    )
  }
  writeFileSync(join(OUT, CALIBRATE ? 'calibration.md' : 'report.md'), `${lines.join('\n')}\n`)
  console.log(lines.join('\n'))

  for (const row of rows) {
    expect.soft(row.notes, `${row.id} plays notes`).toBeGreaterThan(0)
    if (CALIBRATE || row.id === 'original') continue
    expect.soft(row.clippedSamples, `${row.id} clips`).toBe(0)
    expect
      .soft(Math.abs(row.loudnessDb - TARGET_LOUDNESS_DB), `${row.id} loudness`)
      .toBeLessThanOrEqual(LOUDNESS_WINDOW_DB)
  }
})
