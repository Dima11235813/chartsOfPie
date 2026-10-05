import { expect, test, type Page } from '@playwright/test'

/*
 * Regression guard (B-018): every view option must leave the view drawn — checked by counting
 * coloured pixels on the canvas, not just labels — after switching it on AND back off, while
 * playback is paused (nothing new arrives to trigger a redraw).
 */

/** Coloured (non-grey) opaque pixels on the stage canvas; 0 = blank. */
const inkedPixels = (page: Page) =>
  page
    .locator('.stage .viz-canvas, .stage canvas')
    .first()
    .evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')
      if (!ctx || canvas.width === 0) return 0
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let inked = 0
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!)
        const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
        if (data[i + 3]! > 200 && max - min > 60) inked++
      }
      return inked
    })

async function openView(page: Page, label: string, digits = 80) {
  await page.goto('/#p=dorian-marimba')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label })
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < digits; i++) await page.keyboard.press('ArrowRight')
}

/** The view still shows (most of) what it showed before. */
async function expectDrawnLike(page: Page, before: number, what: string) {
  await expect
    .poll(() => inkedPixels(page), { message: `${what}: canvas should be drawn`, timeout: 4_000 })
    .toBeGreaterThan(before * 0.6)
}

test('neighbour mosaic: every option on and off keeps it drawn', async ({ page }) => {
  await openView(page, 'Neighbour mosaic')
  await page.getByRole('slider', { name: 'Columns' }).fill('12')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(500)
  const all = await inkedPixels(page)

  // Sweep on → its own animated canvas; off → the static mosaic again (B-018).
  await page.getByRole('checkbox', { name: 'Sweep' }).check()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  await page.waitForTimeout(600)
  await page.getByRole('checkbox', { name: 'Sweep' }).uncheck()
  await expectDrawnLike(page, all, 'after sweep off')

  // Groups only, then back to every digit.
  const show = page.getByRole('combobox', { name: 'Show' })
  await show.selectOption({ label: 'Groups of 2+' })
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(50)
  await show.selectOption({ label: 'Every digit' })
  await expectDrawnLike(page, all, 'after groups filter off')

  // Isolate a shape from the census, then show all.
  const census = page.getByRole('region', { name: 'Shapes in the mosaic' })
  await census.getByRole('button', { name: /^pair: / }).click()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(20)
  await census.getByRole('button', { name: 'Show all' }).click()
  await expectDrawnLike(page, all, 'after shape filter off')

  // Fit on and off, and a width change.
  await page.getByRole('checkbox', { name: 'Fit' }).check()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  await page.getByRole('checkbox', { name: 'Fit' }).uncheck()
  await page.getByRole('button', { name: 'More columns' }).click()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(all * 0.6)

  // Leaving the view and coming back.
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Digit ring' })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Neighbour mosaic' })
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(all * 0.6)
})

for (const [view, toggle] of [
  ['Music clock', 'Circle of fifths'],
  ['Harmonograph', 'Pure ratios'],
] as const) {
  test(`${view}: "${toggle}" on and off keeps it drawn`, async ({ page }) => {
    await openView(page, view, 12)
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
    const before = await inkedPixels(page)
    const box = page.getByRole('checkbox', { name: toggle })
    await box.check()
    await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
    await box.uncheck()
    await expectDrawnLike(page, before, `${view} after ${toggle} off`)
  })
}

test('guitar fretboard: changing the tuning and back keeps it drawn', async ({ page }) => {
  await openView(page, 'Guitar fretboard', 12)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  const before = await inkedPixels(page)
  const tuning = page.getByRole('combobox', { name: 'Tuning' })
  await tuning.selectOption('dadgad')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  await tuning.selectOption('standard')
  await expectDrawnLike(page, before, 'fretboard after tuning back')
})

test('digit chart: every chart style draws', async ({ page }) => {
  await openView(page, 'Digit chart', 40)
  const style = page.getByRole('combobox', { name: 'Chart style' })
  for (const label of ['Line', 'Polar area', 'Doughnut', 'Radar', 'Bar']) {
    await style.selectOption({ label })
    await expect.poll(() => inkedPixels(page), { message: label }).toBeGreaterThan(50)
  }
})
