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
  // The census only counts while its card is on screen: scroll to it, as a person would.
  await census.scrollIntoViewIfNeeded()
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

/** Share of the canvas width and height spanned by drawn (coloured) pixels. */
const inkedExtent = (page: Page) =>
  page
    .locator('.stage .viz-canvas')
    .first()
    .evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let [left, right, top, bottom] = [width, -1, height, -1]
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!)
          const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!)
          if (data[i + 3]! <= 200 || max - min <= 60) continue
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      return right < 0 ? { x: 0, y: 0 } : { x: (right - left) / width, y: (bottom - top) / height }
    })

test('neighbour mosaic fills the stage: dots grow or shrink to the frame', async ({ page }) => {
  await openView(page, 'Neighbour mosaic')
  // Fit: 80 digits spread over the whole stage, not a small block in a corner.
  await expect.poll(async () => (await inkedExtent(page)).x).toBeGreaterThan(0.85)
  expect((await inkedExtent(page)).y).toBeGreaterThan(0.5)
  // A fixed column count spans the width too, narrow or wide…
  await page.getByRole('checkbox', { name: 'Fit' }).uncheck()
  const columns = page.getByRole('slider', { name: 'Columns' })
  for (const value of ['6', '40']) {
    await columns.fill(value)
    await expect.poll(async () => (await inkedExtent(page)).x).toBeGreaterThan(0.75)
  }
  // …and Fit again, while paused, fills it again.
  await page.getByRole('checkbox', { name: 'Fit' }).check()
  await expect.poll(async () => (await inkedExtent(page)).x).toBeGreaterThan(0.85)
})

test('shape census: Hide stops counting, Show counts again', async ({ page }) => {
  await openView(page, 'Neighbour mosaic')
  const census = page.getByRole('region', { name: 'Shapes in the mosaic' })
  // The census only counts while its card is on screen: scroll to it, as a person would.
  await census.scrollIntoViewIfNeeded()
  const hint = census.getByText(/groups of 2–5 equal neighbours/)
  await expect(hint).toBeVisible()
  const before = await hint.textContent()
  await expect(census.getByRole('button', { name: /: \d+ at this width/ }).first()).toBeVisible()

  await census.getByRole('button', { name: 'Hide' }).click()
  await expect(census.getByRole('button', { name: 'Show' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(census.getByRole('button', { name: /at this width/ })).toHaveCount(0)
  // The mosaic itself is unaffected.
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(500)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowRight')

  // Back on: the count catches up with the digits played meanwhile (140, not 80).
  await census.getByRole('button', { name: 'Show' }).click()
  await expect(hint).not.toHaveText(before!)
  await expect(census.getByRole('button', { name: /: \d+ at this width/ }).first()).toBeVisible()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(500)
})

test('starting point: jump into π and back, while paused, keeps the views drawing', async ({
  page,
}) => {
  await openView(page, 'Neighbour mosaic', 30)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  const where = page.getByRole('region', { name: 'Where in π' })
  // Jumping starts a new performance there: the picture starts over with the new digits.
  await where.getByRole('button', { name: 'Feynman point' }).click()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.stream')).toContainText('999999')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  // …and back to the beginning.
  await where.getByRole('button', { name: 'Beginning' }).click()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.stream .digit').first()).toHaveText('3')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  // Another view after a jump draws too.
  await where.getByRole('button', { name: 'Feynman point' }).click()
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Digit ring' })
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
})

test('number: φ and back to π, while paused, keeps the views drawing', async ({ page }) => {
  await openView(page, 'Digit ring', 30)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  const number = page.getByRole('combobox', { name: 'Number' })
  await number.selectOption({ label: 'φ (golden ratio)' })
  await expect(page).toHaveURL(/s=phi/)
  await expect(page.getByRole('region', { name: 'Where in φ' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'View' })).toContainText('φ walk')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.stream .digit').first()).toHaveText('1')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  // A view chosen while on φ draws φ.
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'φ walk' })
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  // …and back to π.
  await number.selectOption({ label: 'π (pi)' })
  await expect(page).not.toHaveURL(/s=/)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.stream .digit').first()).toHaveText('3')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
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
