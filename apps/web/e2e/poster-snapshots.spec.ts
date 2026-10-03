/**
 * Image regression tests for the artworks: each poster is rendered from the first 2,000 digits of
 * π in the original palette and compared with its baseline in e2e/__snapshots__/. Any change to a
 * renderer's look shows up as an image diff.
 *
 * After an intended visual change: review the new images, then update the baselines with
 *   npm run test:e2e -- poster-snapshots --update-snapshots
 */
import { expect, test } from '@playwright/test'

test('every artwork renders as recorded in its poster baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'posters are the same on every viewport')
  test.setTimeout(120_000)
  await page.goto('/lab.html')
  await page.waitForFunction(() => window.posterLab !== undefined)
  const kinds = await page.evaluate(() => window.posterLab.kinds)
  expect(kinds).toEqual(['ring', 'walk', 'sunflower', 'mosaic', 'hilbert', 'type', 'string-art'])

  for (const kind of kinds) {
    const dataUrl = await page.evaluate((k) => window.posterLab.render(k), kind)
    const png = Buffer.from(dataUrl.split(',')[1]!, 'base64')
    await testInfo.attach(`${kind}.png`, { body: png, contentType: 'image/png' })
    expect.soft(png).toMatchSnapshot(`${kind}.png`, { maxDiffPixelRatio: 0.002, threshold: 0.05 })
  }
})
