/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
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
})
