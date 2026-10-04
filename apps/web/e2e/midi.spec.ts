import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __midiSent: { bytes: number[]; at?: number }[]
  }
}

// A fake Web MIDI device standing in for a Nord Electro 4 on USB.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__midiSent = []
    const output = {
      id: 'out-1',
      name: 'Nord Electro 4 MIDI',
      send: (bytes: number[], at?: number) => window.__midiSent.push({ bytes: [...bytes], at }),
    }
    const access = { outputs: new Map([['out-1', output]]), inputs: new Map(), onstatechange: null }
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: () => Promise.resolve(access),
      configurable: true,
    })
  })
})

test('plays through a MIDI instrument (Nord) on the chosen channel', async ({ page }) => {
  await page.goto('/#p=lydian-dream')
  const play = page.getByRole('button', { name: 'Play' })
  await expect(play).toBeEnabled({ timeout: 15_000 })

  await page.getByText('Play through MIDI').click()
  await page.getByRole('button', { name: 'Connect MIDI' }).click()
  await expect(page.getByText('Send notes to Nord Electro 4 MIDI')).toBeVisible()
  await page.getByLabel('Channel').selectOption('2')
  await page.getByLabel('Play on').selectOption('midi-only')

  await play.click()
  // Note-ons on channel 2 (status 0x91), with timestamps.
  await expect
    .poll(() => page.evaluate(() => window.__midiSent.filter((m) => m.bytes[0] === 0x91).length))
    .toBeGreaterThan(2)
  const first = await page.evaluate(() => window.__midiSent.find((m) => m.bytes[0] === 0x91)!)
  expect(first.at).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Pause' }).click()
  // Pause silences the instrument: All Notes Off (CC 123) on channel 2.
  await expect
    .poll(() =>
      page.evaluate(() => window.__midiSent.some((m) => m.bytes[0] === 0xb1 && m.bytes[1] === 123)),
    )
    .toBe(true)
})
