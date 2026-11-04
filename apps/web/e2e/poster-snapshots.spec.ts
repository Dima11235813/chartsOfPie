/**
 * Image regression tests for the artworks: each poster is rendered from the first 2,000 digits of
 * π in the original palette and compared with its baseline in e2e/__snapshots__/. Any change to a
 * renderer's look shows up as an image diff.
 *
 * After an intended visual change: review the new images, then update the baselines with
 *   npm run test:e2e -- poster-snapshots --update-snapshots
 */
import { expect, test, type Page } from '@playwright/test'

/**
 * Typographic posters are rasterised text, and glyph edges come out differently on every machine
 * (fontconfig hinting differs between the cloud container and the CI runner even with the same
 * Chromium and the same bundled font, B-027). So they are compared 4× box-downscaled: per-glyph
 * edge noise averages out, while a changed layout, colour, glow or missing run still fails. The
 * bundled face is checked separately, by name, so a silent fallback font cannot hide in the blur.
 */
const TEXT_KINDS = new Set(['type'])
const DOWNSCALE = 4

async function posterPng(page: Page, kind: string, options?: object): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ([k, o, scale]) => {
      const url = await window.posterLab.render(k as string, o as never)
      if (!(scale as number)) return url
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.width / (scale as number)
      canvas.height = image.height / (scale as number)
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png')
    },
    [kind, options ?? {}, TEXT_KINDS.has(kind) ? DOWNSCALE : 0] as const,
  )
  return Buffer.from(dataUrl.split(',')[1]!, 'base64')
}

/** The typographic view's bundled face must be the one that drew, not an OS fallback (B-027). */
async function expectTypeFontLoaded(page: Page) {
  const faces = await page.evaluate(() =>
    [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`),
  )
  expect(faces, 'bundled JetBrains Mono loaded for the typographic poster').toContainEqual(
    expect.stringMatching(/JetBrains Mono.* 600 loaded/),
  )
}

test('every artwork renders as recorded in its poster baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'posters are the same on every viewport')
  test.setTimeout(120_000)
  await page.goto('/lab.html')
  await page.waitForFunction(() => window.posterLab !== undefined)
  const kinds = await page.evaluate(() => window.posterLab.kinds)
  expect(kinds).toEqual([
    'ring',
    'walk',
    'sunflower',
    'mosaic',
    'hilbert',
    'golden',
    'type',
    'string-art',
  ])

  for (const kind of kinds) {
    const png = await posterPng(page, kind)
    await testInfo.attach(`${kind}.png`, { body: png, contentType: 'image/png' })
    expect.soft(png).toMatchSnapshot(`${kind}.png`, { maxDiffPixelRatio: 0.002, threshold: 0.05 })
    if (TEXT_KINDS.has(kind)) await expectTypeFontLoaded(page)
  }
})

test('other numbers draw their own digits (φ)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'posters are the same on every viewport')
  await page.goto('/lab.html')
  await page.waitForFunction(() => window.posterLab !== undefined)
  for (const kind of ['walk', 'mosaic']) {
    const png = await posterPng(page, kind, { series: 'phi' })
    await testInfo.attach(`phi-${kind}.png`, { body: png, contentType: 'image/png' })
    expect
      .soft(png)
      .toMatchSnapshot(`phi-${kind}.png`, { maxDiffPixelRatio: 0.002, threshold: 0.05 })
  }
})

test('a 12-symbol reading draws twelve arcs, directions and colours (Fibonacci mod 12)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'posters are the same on every viewport')
  await page.goto('/lab.html')
  await page.waitForFunction(() => window.posterLab !== undefined)
  for (const kind of ['ring', 'walk', 'type', 'string-art']) {
    const png = await posterPng(page, kind, { series: 'fibonacci', reading: 'mod-12' })
    await testInfo.attach(`mod12-${kind}.png`, { body: png, contentType: 'image/png' })
    if (TEXT_KINDS.has(kind)) await expectTypeFontLoaded(page)
    expect
      .soft(png)
      .toMatchSnapshot(`mod12-${kind}.png`, { maxDiffPixelRatio: 0.002, threshold: 0.05 })
  }
})
