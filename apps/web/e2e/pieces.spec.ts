import { expect, test } from '@playwright/test'

test('saves a piece on the device and resumes it after a reload; backups round-trip', async ({
  page,
}, testInfo) => {
  await page.goto('/#p=acoustic-folk')
  await expect(page.getByRole('button', { name: 'Step' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('combobox', { name: 'View' }).selectOption({ label: 'Guitar fretboard' })
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('total-count')).toHaveText('5')
  await page.getByLabel('Name', { exact: true }).fill('Folk on the fretboard')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Folk on the fretboard', { exact: true })).toBeVisible()
  await testInfo.attach('my-pieces.png', {
    body: await page.locator('.pieces-panel').screenshot(),
    contentType: 'image/png',
  })

  // Somewhere else entirely, then reopen the piece: sound, view and position come back.
  await page.goto('/#p=original')
  await page.reload()
  await expect(page.getByTestId('total-count')).toHaveText('0')
  await page.getByRole('button', { name: 'Open Folk on the fretboard' }).click()
  await expect(page.getByLabel('Preset')).toHaveValue('acoustic-folk')
  await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('fretboard')
  await expect(page.getByTestId('total-count')).toHaveText('5')

  // Backup: export, delete, import.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await (await download).path()
  await page.getByRole('button', { name: 'Delete Folk on the fretboard' }).click()
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Folk on the fretboard' })).toHaveCount(0)
  await page.getByLabel('Import pieces').setInputFiles(file)
  await expect(page.getByText('Imported 1 of 1 piece.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Folk on the fretboard' })).toBeVisible()
})
