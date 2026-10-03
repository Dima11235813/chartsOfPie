/**
 * Audio regression tests: every preset is rendered offline (deterministic digits, seed and noise)
 * and its spectrogram compared with the committed baseline in e2e/__snapshots__/. A change to an
 * instrument, effect, preset, mapping or timing shows up as a failed image diff — so audio changes
 * are always deliberate.
 *
 * After an intended sound change: review the new images, then update the baselines with
 *   npm run test:e2e -- audio-snapshots --update-snapshots
 */
import { expect, test } from '@playwright/test'

const SECONDS = 8
const TARGET_LOUDNESS_DB = -14
const LOUDNESS_WINDOW_DB = 2

test.describe('audio snapshots', () => {
  test('every preset sounds as recorded in its spectrogram baseline', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'audio is the same on every viewport')
    test.setTimeout(180_000)
    await page.goto('/lab.html')
    await page.waitForFunction(() => window.audioLab !== undefined)
    const presetIds = await page.evaluate(() => window.audioLab.presetIds)
    expect(presetIds).toContain('original')

    for (const id of presetIds) {
      const result = await page.evaluate(
        async ({ id, seconds }) => {
          await window.audioLab.ready
          return window.audioLab.render(id, { seconds, seed: 1 })
        },
        { id, seconds: SECONDS },
      )
      const png = Buffer.from(result.spectrogram.split(',')[1]!, 'base64')
      await testInfo.attach(`${id}.png`, { body: png, contentType: 'image/png' })

      expect.soft(result.notes, `${id} plays notes`).toBeGreaterThan(0)
      if (id !== 'original') {
        expect.soft(result.stats.clippedSamples, `${id} clipping`).toBe(0)
        expect
          .soft(Math.abs(result.stats.loudnessDb - TARGET_LOUDNESS_DB), `${id} loudness`)
          .toBeLessThanOrEqual(LOUDNESS_WINDOW_DB)
      }
      expect.soft(png).toMatchSnapshot(`${id}.png`, {
        maxDiffPixelRatio: 0.002,
        // Run-to-run noise is ≤ 1 colour level on < 0.05% of pixels; a +15% reverb change moves
        // ~60% of pixels by 9–20 levels. 0.02 sits well between the two.
        threshold: 0.02,
      })
    }
  })
})
