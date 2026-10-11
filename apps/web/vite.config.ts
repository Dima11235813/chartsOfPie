/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

/** A port from apps/web/.env.local (see .env.example), or the default. */
const portFrom = (value: string | undefined, fallback: number) => {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 ? port : fallback
}

export default defineConfig(({ mode }) => {
  // Local ports follow the owner's port-allocation rules; set them in .env.local, not here.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    server: { port: portFrom(env.WEB_PORT, 5173), strictPort: true },
    preview: { port: portFrom(env.PREVIEW_PORT, 4173), strictPort: true },
    // Served from a sub-path on GitHub Pages (https://<user>.github.io/chartsOfPie/); every asset URL
    // goes through import.meta.env.BASE_URL, so the same build works at any base.
    base: process.env.BASE_PATH ?? '/',
    plugins: [react()],
    build: {
      rollupOptions: {
        // lab.html: deterministic offline renders (audio spectrograms, posters) for regression tests.
        input: { main: page('./index.html'), lab: page('./lab.html') },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
