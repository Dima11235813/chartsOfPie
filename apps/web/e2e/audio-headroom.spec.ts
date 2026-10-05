/**
 * Headroom regression test (B-019): turning the volume up or adding reverb, echo or a drone must
 * never hard-clip the output, with or without master compression. Before the fix, Original at
 * +6 dB hard-clipped ~2% of its samples, which sounds like crackly distortion on a phone.
 */
import { expect, test } from '@playwright/test'

const SECONDS = 8

const LOUD_CASES: { name: string; preset: string; changes: Record<string, unknown> }[] = [
  { name: 'Original at +6 dB', preset: 'original', changes: { volume: 6 } },
  { name: 'Original at +3 dB', preset: 'original', changes: { volume: 3 } },
  {
    name: 'Original with full reverb and echo',
    preset: 'original',
    changes: { reverb: 1, echo: 1 },
  },
  { name: 'Original with a drone', preset: 'original', changes: { drone: true } },
  {
    name: 'Clavinet funk without compression',
    preset: 'clavinet-funk',
    changes: { compress: false },
  },
  {
    name: 'Clavinet funk at +6 dB with full reverb and echo',
    preset: 'clavinet-funk',
    changes: { reverb: 1, echo: 1 },
  },
]

test('louder settings never hard-clip the output', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'audio is the same on every viewport')
  test.setTimeout(120_000)
  await page.goto('/lab.html')
  await page.waitForFunction(() => window.audioLab !== undefined)

  for (const { name, preset, changes } of LOUD_CASES) {
    const result = await page.evaluate(
      async ({ name, preset, changes, seconds }) => {
        await window.audioLab.ready
        const config = { ...(window.audioLab.presetConfig(preset) as object), ...changes }
        return window.audioLab.render({ id: preset, name, config }, { seconds, seed: 1 })
      },
      { name, preset, changes, seconds: SECONDS },
    )
    expect.soft(result.notes, `${name} plays notes`).toBeGreaterThan(0)
    expect.soft(result.stats.clippedSamples, `${name}: hard-clipped samples`).toBe(0)
    expect.soft(result.stats.peakDb, `${name}: peak dBFS`).toBeLessThan(0)
  }
})
