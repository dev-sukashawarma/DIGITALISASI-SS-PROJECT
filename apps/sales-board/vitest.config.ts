import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
