/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig({
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
