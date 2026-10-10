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

test('number: Fibonacci, both readings, and back to π, while paused, keeps views drawing', async ({
  page,
}) => {
  await openView(page, 'Neighbour mosaic', 30)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  const number = page.getByRole('combobox', { name: 'Number' })
  const reading = page.getByRole('combobox', { name: 'Reading' })
  await expect(reading).toHaveCount(0) // π has one reading: no picker
  const stream = page.locator('.stream')
  const step = async (n: number) => {
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight')
  }

  // All digits (the default): 0 1 1 2 3 5 8 13 21 34 …
  await number.selectOption({ label: 'Fibonacci numbers' })
  await expect(page).toHaveURL(/s=fibonacci(&|$)/)
  await expect(reading).toHaveValue('concat')
  const where = page.getByRole('region', { name: 'Where in Fibonacci' })
  await expect(where).toContainText('0 1 1 2 3 5 8 1 3… — 1,000,000 digits loaded')
  await step(13)
  await expect(stream).toHaveText('0112358132134')
  await expect(page.locator('.readout dt').nth(1)).toHaveText('Digit') // not "Decimal place"
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)

  // Last digit: Fₙ mod 10 — 0 1 1 2 3 5 8 3 1 4 5 9 4 3 7 0 7 7 4 1 5 …
  await reading.selectOption({ label: 'Last digit' })
  await expect(page).toHaveURL(/s=fibonacci\.last-digit/)
  await step(21)
  await expect(stream).toHaveText('011235831459437077415')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)

  // …back to all digits, and back to π.
  await reading.selectOption({ label: 'All digits' })
  await expect(page).toHaveURL(/s=fibonacci(&|$)/)
  await number.selectOption({ label: 'π (pi)' })
  await expect(page).not.toHaveURL(/s=/)
  await expect(reading).toHaveCount(0)
  await step(5)
  await expect(stream).toHaveText('31415')
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
})

test('Fibonacci: jump to Fₙ, terms, Benford table, loop widths on and off', async ({ page }) => {
  await openView(page, 'Neighbour mosaic', 0)
  await page.getByRole('combobox', { name: 'Number' }).selectOption({ label: 'Fibonacci numbers' })
  const where = page.getByRole('region', { name: 'Where in Fibonacci' })
  const step = async (n: number) => {
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight')
  }

  // F₁₀₀ = 354224848179261915075 starts at digit 1,051.
  await where.getByLabel(/Jump to Fₙ/).fill('100')
  await where.getByRole('button', { name: 'Jump' }).click()
  await expect(where.getByRole('status')).toHaveText('F₁₀₀ starts at digit 1,051.')
  await expect(where).toContainText('Starting at digit 1,051 of 999,999 (in F₁₀₀)')
  await step(21)
  await expect(page.locator('.stream')).toHaveText('354224848179261915075')
  await expect(page.getByTestId('term')).toHaveText('in F₁₀₀')
  // First digits so far: F₁₀₀ and F₁₀₁ have started… only F₁₀₀ wholly inside: one 3.
  await expect(page.getByTestId('first-digits')).toBeVisible()
  await expect(page.getByTestId('first-digits')).toContainText('30.10%') // Benford for 1

  // Last digit: F₁₂₃ ends in 2, step 4 of the 60-step loop; the mosaic offers loop widths.
  await page.getByRole('combobox', { name: 'Reading' }).selectOption({ label: 'Last digit' })
  await expect(page.getByTestId('first-digits')).toHaveCount(0)
  await where.getByLabel(/Jump to Fₙ/).fill('123')
  await where.getByRole('button', { name: 'Jump' }).click()
  await expect(where.getByRole('status')).toHaveText('F₁₂₃: step 4 of the 60-step loop.')
  await step(120)
  await expect(page.locator('.stream .digit').first()).toHaveText(/\d/)
  const loop = page.getByRole('group', { name: 'Loop widths' })
  await loop.getByRole('button', { name: /^60 columns/ }).click()
  await expect(loop.getByRole('button', { name: /^60 columns/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('img', { name: /in 60 columns/ })).toBeVisible()
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)
  await expect(page.getByTestId('loop-note')).toContainText('repeats every 60 digits')
  // …and back to Fit (rule 9).
  await page.getByRole('checkbox', { name: 'Fit' }).check()
  await expect(loop.getByRole('button', { name: /^60 columns/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(200)

  // π has none of this.
  await page.getByRole('combobox', { name: 'Number' }).selectOption({ label: 'π (pi)' })
  await expect(page.getByRole('group', { name: 'Loop widths' })).toHaveCount(0)
  await expect(where).toHaveCount(0)
  await expect(page.getByLabel(/Jump to Fₙ/)).toHaveCount(0)
})

for (const [view, toggle] of [
  ['Music clock', 'Circle of fifths'],
  ['Harmonograph', 'Pure ratios'],
  ['Harmonograph', 'Golden ratio'],
  ['String art', 'Golden ratios'],
  ['Sunflower', 'Spirals'],
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

test('sunflower spirals name the Fibonacci families, and go away again', async ({ page }) => {
  await openView(page, 'Sunflower', 120)
  const flower = page.getByRole('img', { name: /Sunflower/ })
  await expect(flower).not.toHaveAttribute('aria-label', /spirals turn/)
  await page.getByRole('checkbox', { name: 'Spirals' }).check()
  // 120 seeds: the outer seeds' nearest neighbours are 21 and 34 steps back.
  await expect(flower).toHaveAttribute('aria-label', /21 spirals turn one way and 34 the other/)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
  await page.getByRole('checkbox', { name: 'Spirals' }).uncheck()
  await expect(flower).not.toHaveAttribute('aria-label', /spirals turn/)
  await expect.poll(() => inkedPixels(page)).toBeGreaterThan(100)
})

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
