import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  // One baseline per snapshot for every OS (audio spectrograms are rendered in JS, not by the OS).
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileName}/{arg}{ext}',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Linux Chrome takes font hinting and LCD smoothing from the OS's fontconfig, so the same font
    // and Chromium rasterise text differently per machine (B-027). Pin unhinted grayscale text,
    // which the cloud container uses, so the typographic poster baselines match on CI too.
    launchOptions: { args: ['--font-render-hinting=none', '--disable-lcd-text'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
