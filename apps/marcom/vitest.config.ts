import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  root: __dirname,
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
