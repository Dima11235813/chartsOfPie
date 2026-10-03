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

  // The semitones mapping (Raw digits) ignores the scale, so the picker is disabled there.
  await preset.selectOption({ label: 'Raw digits' })
  await page.getByText('Customize').click()
  await expect(page.getByLabel('Scale')).toBeDisabled()

  // Customising switches to a shareable custom config that survives a reload.
  await preset.selectOption({ label: 'Pentatonic piano' })
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

test('sheet music, live spectrogram and exports (MIDI, image, video, audio)', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/#p=lydian-dream')
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  await play.click()
  const view = page.getByRole('combobox', { name: 'View' })

  // Sheet music draws noteheads (coloured pixels) on the staff.
  await view.selectOption({ label: 'Sheet music' })
  const staff = page.getByRole('img', { name: /Sheet music/ })
  await expect(staff).toHaveAttribute('aria-label', /Latest notes/, { timeout: 10_000 })
  await testInfo.attach('sheet-music.png', {
    body: await staff.screenshot(),
    contentType: 'image/png',
  })

  // The spectrogram shows energy (bright pixels) once sound is playing.
  await view.selectOption({ label: 'Spectrogram' })
  const spectrogram = page.getByRole('img', { name: /Live spectrogram/ })
  await expect
    .poll(
      () =>
        spectrogram.evaluate((canvas: HTMLCanvasElement) => {
          const ctx = canvas.getContext('2d')!
          const { data } = ctx.getImageData(canvas.width - 40, 0, 30, canvas.height)
          let bright = 0
          for (let i = 0; i < data.length; i += 4) if (data[i]! > 120) bright++
          return bright
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(20)
  await testInfo.attach('spectrogram.png', {
    body: await spectrogram.screenshot(),
    contentType: 'image/png',
  })

  const save = async (name: string | RegExp) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name }).click(),
    ])
    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    return { name: download.suggestedFilename(), bytes: readFileSync(path) }
  }

  const midi = await save('Download MIDI')
  expect(midi.name).toMatch(/^charts-of-pie-lydian-dream-\d{8}-\d{6}\.mid$/)
  expect(midi.bytes.subarray(0, 4).toString('latin1')).toBe('MThd')

  const image = await save('Save image')
  expect(image.name).toMatch(/\.png$/)
  expect(image.bytes.subarray(1, 4).toString('latin1')).toBe('PNG')

  await page.getByRole('button', { name: '● Record video' }).click()
  await expect(page.getByRole('button', { name: /■ Stop 0:0[2-9]/ })).toBeVisible({
    timeout: 10_000,
  })
  await page.getByRole('button', { name: /■ Stop/ }).click()
  const video = await save(/Download video/)
  expect(video.name).toMatch(/\.(webm|mp4)$/)
  expect(video.bytes.length).toBeGreaterThan(5_000)
  const audio = await save(/Download audio/)
  expect(audio.name).toMatch(/-audio-.*\.(webm|mp4|ogg)$/)
  expect(audio.bytes.length).toBeGreaterThan(1_000)

  expect(errors).toEqual([])
})
