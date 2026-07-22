import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  root: __dirname,
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
