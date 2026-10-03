import { expect, test } from '@playwright/test'

test('plays the digits of π with sound and a live chart', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  await expect(page).toHaveTitle('Charts of Pie')
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  await expect(page.locator('canvas')).toBeVisible()

  await play.click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect
    .poll(async () =>
      Number((await page.getByTestId('total-count').textContent())?.replace(/,/g, '')),
    )
    .toBeGreaterThan(5)
  await expect(page.getByTestId('sound-data')).toHaveText(/^[A-G]#?\d for \d+[nt]$/)

  // Stream starts at the leading 3 of π.
  await expect(page.locator('.stream .digit').first()).toHaveText('3')

  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = await page.getByTestId('total-count').textContent()
  await page.waitForTimeout(600)
  await expect(page.getByTestId('total-count')).toHaveText(paused ?? '')

  for (const style of ['Horizontal bar', 'Line', 'Polar area', 'Doughnut', 'Pie', 'Radar', 'Bar']) {
    await page.getByRole('combobox', { name: 'Chart style' }).selectOption({ label: style })
    await expect(page.locator('canvas')).toBeVisible()
  }

  // No horizontal scrolling at any viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}.png`),
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('every sound preset plays without errors', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/')
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  const preset = page.getByLabel('Preset')
  const names = await preset.locator('option').allTextContents()
  expect(names.length).toBeGreaterThanOrEqual(8)

  await play.click()
  for (const name of names) {
    await preset.selectOption({ label: name })
    const before = Number(await page.getByTestId('total-count').textContent())
    await expect
      .poll(async () => Number(await page.getByTestId('total-count').textContent()), {
        timeout: 10_000,
      })
      .toBeGreaterThan(before + 1)
  }
  await page.getByRole('button', { name: 'Pause' }).click()

  // Customising switches to a shareable custom config that survives a reload.
  await page.getByText('Customize').click()
  await page.getByLabel('Scale').selectOption({ label: 'Lydian' })
  await expect(preset).toHaveValue('custom')
  await expect(page).toHaveURL(/#c=/)
  await page.reload()
  await expect(page.getByLabel('Scale')).toHaveValue('lydian')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  expect(errors).toEqual([])
})
