import { defineConfig, devices } from '@playwright/test'

const PORT = 5179

/** Offline audio renders (see scripts/render-presets.spec.ts); runs against the Vite dev server. */
export default defineConfig({
  testDir: './scripts',
  testMatch: 'render-presets.spec.ts',
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
