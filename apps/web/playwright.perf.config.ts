import { defineConfig, devices } from '@playwright/test'

const PORT = 4180

/**
 * Performance harness (scripts/perf.spec.ts): plays a fast tempo on every view against the
 * production build and reports main-thread load, long tasks and frame gaps. `npm run perf`.
 */
export default defineConfig({
  testDir: './scripts',
  testMatch: 'perf.spec.ts',
  reporter: 'list',
  workers: 1,
  timeout: 10 * 60_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npx vite build --logLevel error --minify false && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
