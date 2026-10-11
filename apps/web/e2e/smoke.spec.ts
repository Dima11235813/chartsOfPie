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

test('artistic views draw and follow the colour palette', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.goto('/#p=dorian-marimba') // fast sixteenths → many digits quickly
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  await play.click()
  await expect
    .poll(async () =>
      Number((await page.getByTestId('total-count').textContent())?.replace(/,/g, '')),
    )
    .toBeGreaterThan(20)

  /** Count of clearly coloured (non-background) pixels on the view canvas. */
  const inkedPixels = (name: RegExp) =>
    page.getByRole('img', { name }).evaluate((canvas: HTMLCanvasElement) => {
      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      let inked = 0
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3]! > 0 && data[i]! + data[i + 1]! + data[i + 2]! > 150) inked++
      return inked
    })

  const view = page.getByRole('combobox', { name: 'View' })
  for (const [label, name, summary] of [
    ['Digit ring', /Digit ring/, /\d+ digits woven/],
    ['π walk', /π walk/, /\d+ steps/],
    ['Sunflower', /Sunflower/, /\d+ seeds/],
    ['Neighbour mosaic', /Neighbour mosaic/, /\d+ digits in \d+ columns/],
    ['Music clock', /Music clock/, /Now: /],
    ['String art', /Times-table string art/, /k = \d/],
    ['Hilbert carpet', /Hilbert carpet/, /\d+ of 1,000,001 digits lit/],
    ['Typographic π', /Typographic π/, /\d+ digits set in type/],
    ['Harmonograph', /Harmonograph/, / · ratio \d/],
    ['Oscilloscope', /Oscilloscope/, /vectorscope/],
    ['Guitar fretboard', /Guitar fretboard/, /Now: .* · string \d, (open|fret \d+)/],
    ['Cymatics (Chladni plate)', /Cymatics/, /plate mode/],
  ] as const) {
    await view.selectOption({ label })
    await expect(page.getByRole('img', { name })).toHaveAttribute('aria-label', summary, {
      timeout: 10_000,
    })
    await expect.poll(() => inkedPixels(name)).toBeGreaterThan(200)
    await testInfo.attach(`${label}.png`, {
      body: await page.getByRole('img', { name }).screenshot(),
      contentType: 'image/png',
    })
  }

  // The music clock can switch to the circle of fifths.
  await view.selectOption({ label: 'Music clock' })
  await page.getByRole('checkbox', { name: 'Circle of fifths' }).check()
  await expect(page.getByRole('img', { name: /Music clock \(circle of fifths\)/ })).toBeVisible()
  await view.selectOption({ label: 'Sunflower' })

  // Changing the palette redraws the picture in the new colours.
  await page.getByRole('button', { name: 'Pause' }).click()
  const before = await page.getByRole('img', { name: /Sunflower/ }).screenshot()
  await page
    .getByRole('combobox', { name: 'Colours' })
    .selectOption({ label: 'Colour-blind friendly' })
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.getByRole('img', { name: /Sunflower/ }).screenshot()),
    )
    .not.toBe(0)

  // Reset clears the drawing.
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByRole('img', { name: /Sunflower/ })).toHaveAttribute(
    'aria-label',
    /No digits yet/,
  )
  expect(errors).toEqual([])
})

test('downloads a print-size poster', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough for a file download')
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByLabel('Artwork').selectOption({ label: 'Neighbour mosaic' })
  await page.getByLabel('Digits of π', { exact: true }).selectOption('1000')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download poster' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(
    /^charts-of-pie-poster-mosaic-1000-\d{8}-\d{6}\.png$/,
  )
  const { readFileSync } = await import('node:fs')
  const png = readFileSync(await download.path())
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG')
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2048, 2048])
  await expect(page.getByRole('button', { name: 'Download poster' })).toBeEnabled()
})

test('the view and its options travel in the link and survive a reload', async ({ page }) => {
  await page.goto('/#p=lydian-dream')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Music clock' })
  await page.getByRole('checkbox', { name: 'Circle of fifths' }).check()
  await page.getByRole('combobox', { name: 'Colours' }).selectOption({ label: 'Ink (sequential)' })
  await expect(page).toHaveURL(/#p=lydian-dream&v=/)

  await page.reload()
  await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('clock')
  await expect(page.getByRole('checkbox', { name: 'Circle of fifths' })).toBeChecked()
  await expect(page.getByRole('combobox', { name: 'Colours' })).toHaveValue('ink')
  await expect(page.getByLabel('Preset')).toHaveValue('lydian-dream')

  // Links made before views were shareable still open exactly as before.
  await page.goto('/#p=music-box')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('chart')
  await expect(page.getByLabel('Preset')).toHaveValue('music-box')
})

test('start anywhere in π: jump, search, share and reach the last digit', async ({ page }) => {
  await page.goto('/#p=dorian-marimba')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  const where = page.getByRole('region', { name: 'Where in π' })
  await expect(where).toContainText('1,000,000 decimal places loaded')

  // The Feynman point: six 9s from decimal place 762, and the link remembers it.
  await where.getByRole('button', { name: 'Feynman point' }).click()
  await expect(where.getByRole('status')).toContainText('decimal place 762')
  await expect(page).toHaveURL(/at=762/)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.stream')).toHaveText('999999')
  await expect(page.getByTestId('decimal-place')).toHaveText('767')
  await expect(page.getByTestId('total-count')).toHaveText('6')

  // A reload (or a shared link) starts at the same place.
  await page.reload()
  await expect(where).toContainText('Starting at decimal place 762 of 1,000,000')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('decimal-place')).toHaveText('762')
  await expect(page.getByTestId('current-digit')).toHaveText('9')

  // Search for a date, then its next occurrence.
  await where.getByLabel('Find digits').fill('14/03')
  await where.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(where.getByRole('status')).toHaveText(/^Found 1403 at decimal place [\d,]+\.$/)
  const placeOf = async () =>
    Number((await where.getByLabel('Decimal place').inputValue()).replace(/,/g, ''))
  const first = await placeOf()
  await where.getByRole('button', { name: 'Find next 1403' }).click()
  await expect.poll(placeOf).toBeGreaterThan(first)

  // The very last decimal place loaded, then back to the beginning (the link drops at=).
  await where.getByLabel('Decimal place').fill('1,000,000')
  await where.getByRole('button', { name: 'Go' }).click()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('decimal-place')).toHaveText('1,000,000')
  await expect(page.getByTestId('current-digit')).toHaveText('1')
  await where.getByLabel('Decimal place').fill('2000000')
  await where.getByRole('button', { name: 'Go' }).click()
  await expect(where.getByRole('status')).toContainText('from 0 to 1,000,000')
  await where.getByRole('button', { name: 'Beginning' }).click()
  await expect(page).not.toHaveURL(/at=/)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('current-digit')).toHaveText('3')
})

test('the neighbour mosaic narrows and widens, and the pattern re-flows', async ({
  page,
}, testInfo) => {
  await page.goto('/#p=dorian-marimba')
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Neighbour mosaic' })
  await play.click()
  const mosaic = page.getByRole('img', { name: /Neighbour mosaic/ })
  await expect(mosaic).toHaveAttribute('aria-label', /[1-9][\d,]* digits in \d+ columns/, {
    timeout: 10_000,
  })
  await page.getByRole('button', { name: 'Pause' }).click()

  // Choosing a width re-lays every digit already played.
  const columns = page.getByRole('slider', { name: 'Columns' })
  await columns.fill('7')
  await expect(mosaic).toHaveAttribute(
    'aria-label',
    /in 7 columns\. A vertical link joins equal digits 7 places apart/,
  )
  await expect(page.getByRole('checkbox', { name: 'Fit' })).not.toBeChecked()
  await page.getByRole('button', { name: 'More columns' }).click()
  await expect(mosaic).toHaveAttribute('aria-label', /in 8 columns/)
  await testInfo.attach('mosaic-8-columns.png', {
    body: await mosaic.screenshot(),
    contentType: 'image/png',
  })

  // The choice travels in the link; Fit goes back to filling the width.
  await page.reload()
  await expect(page.getByRole('slider', { name: 'Columns' })).toHaveValue('8')
  await page.getByRole('checkbox', { name: 'Fit' }).check()
  await expect(page.getByRole('checkbox', { name: 'Fit' })).toBeChecked()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('no horizontal scroll at 360 px wide, with every panel open', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/#p=acoustic-folk')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByText('Customize').click()
  await page.getByText('Play through MIDI').click()
  for (const view of ['Guitar fretboard', 'Neighbour mosaic', 'Music clock']) {
    await page.getByRole('combobox', { name: 'View' }).selectOption({ label: view })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, view).toBeLessThanOrEqual(0)
  }
})

test('golden-ratio rhythms: Fibonacci word long–short, and back to steady', async ({ page }) => {
  await page.goto('/#p=golden-word')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await expect(page.getByLabel('Preset')).toHaveValue('golden-word')
  const playing = page.getByTestId('sound-data')
  let played = 0
  const step = async () => {
    await page.getByRole('button', { name: 'Step' }).click()
    await expect(page.getByTestId('total-count')).toHaveText(String(++played))
    return (await playing.textContent())?.replace(/^.* for /, '')
  }
  // 100 BPM eighths: 0.3 s steps; long = 0.3 × 1.171 × legato 1.1, short = 0.3 × 0.724 × 1.1.
  expect([await step(), await step(), await step(), await step(), await step()]).toEqual([
    '0.39 s',
    '0.24 s',
    '0.39 s',
    '0.39 s',
    '0.24 s',
  ])
  // Switch the rhythm off and on again (rule 9): steady gives equal steps.
  await page.getByText('Customize').click()
  const rhythm = page.getByLabel('Rhythm')
  await rhythm.selectOption({ label: 'Steady' })
  expect([await step(), await step()]).toEqual(['0.33 s', '0.33 s'])
  await rhythm.selectOption({ label: 'Zeckendorf ruler' })
  await expect(page).toHaveURL(/#c=/)
  await page.getByRole('button', { name: 'Reset' }).click()
  played = 0
  // 1 2 3 1 5 steps of 0.3 s, × legato 1.1.
  expect([await step(), await step(), await step(), await step(), await step()]).toEqual([
    '0.33 s',
    '0.66 s',
    '0.99 s',
    '0.33 s',
    '1.65 s',
  ])
})

test('swing and full screen', async ({ page }) => {
  await page.goto('/#p=pentatonic-piano')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByText('Customize').click()
  const swing = page.getByLabel('Swing')
  await swing.fill('0.33')
  await expect(page.getByText('33% (triplet)')).toBeVisible()
  await expect(page).toHaveURL(/#c=/)
  await page.reload()
  await page.getByText('Customize').click()
  await expect(page.getByLabel('Swing')).toHaveValue('0.33')
  // Golden swing: long : short = φ, kept exactly through the link.
  await page.getByRole('button', { name: 'Golden swing' }).click()
  await expect(page.getByText('24% (golden, φ : 1)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Golden swing' })).toBeDisabled()
  await page.reload()
  await page.getByText('Customize').click()
  await expect(page.getByText('24% (golden, φ : 1)')).toBeVisible()

  await page.getByRole('button', { name: 'Full screen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe('stage')
  // F leaves full screen. On a slow CI runner Chrome can still be finishing the transition into
  // full screen and drop an exit requested at that moment (B-022), so press again while the page
  // is still full screen. That is safe (the shortcut only exits while full screen) and still fails
  // if F never works.
  await expect(async () => {
    if (await page.evaluate(() => document.fullscreenElement !== null))
      await page.keyboard.press('f')
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement), { timeout: 1_500 })
      .toBeNull()
  }).toPass({ timeout: 10_000 })
})

test('mosaic: groups only, and a sweep that re-groups the digits as the width changes', async ({
  page,
}) => {
  await page.goto('/#p=dorian-marimba')
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Neighbour mosaic' })
  await page.getByRole('slider', { name: 'Columns' }).fill('12')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowRight')

  const mosaic = page.getByRole('img', { name: /Neighbour mosaic/ })
  await page.getByRole('combobox', { name: 'Show' }).selectOption({ label: 'Groups of 2+' })
  await expect(mosaic).toHaveAttribute('aria-label', /Showing only groups of 2 or more/)

  // Shape census: the groups' shapes, counted; picking one isolates it in the mosaic.
  const census = page.getByRole('region', { name: 'Shapes in the mosaic' })
  // The census only counts while its card is on screen: scroll to it, as a person would.
  await census.scrollIntoViewIfNeeded()
  await expect(census.getByText(/found \d+ of 22 shapes/)).toBeVisible()
  const pair = census.getByRole('button', { name: /^pair: \d+ at this width/ })
  await pair.click()
  await expect(pair).toHaveAttribute('aria-pressed', 'true')
  await expect(mosaic).toHaveAttribute('aria-label', /Showing only one shape/)
  await census.getByRole('button', { name: 'Show all' }).click()
  await expect(mosaic).toHaveAttribute('aria-label', /Showing only groups of 2 or more/)

  await page.getByRole('checkbox', { name: 'Sweep' }).check()
  await expect(page.getByRole('img', { name: /sweeping from 6 to 18 columns/ })).toBeVisible()
  await page.getByRole('combobox', { name: 'Speed' }).selectOption({ label: 'Fast' })
  const count = page.locator('.viz-columns-count')
  await expect(count).not.toHaveText('12 columns', { timeout: 5_000 })
  // The saved width stays 12; the sweep and the filter travel in the link.
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Show' })).toHaveValue('2')
  await expect(page.getByRole('checkbox', { name: 'Sweep' })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Sweep' }).uncheck()
  await expect(count).toHaveText('12 columns')
})
