import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // @tanstack/react-query is hoisted to the monorepo root and, when
    // externalized, Node-resolves react to the root's react@19 — mismatching
    // the app's react@18 renderer (null hook dispatcher). Inlining lets Vite
    // process it so the dedupe below collapses it onto the single react copy.
    server: { deps: { inline: [/@tanstack\/react-query/, /@testing-library\/react/] } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    // The monorepo hoists react@19 to the root while this app uses react@18,
    // and @testing-library/react nests its own react@19. Without deduping,
    // the test renderer and the component-under-test load different React
    // copies → "Element from an older version of React" at runtime.
    dedupe: ['react', 'react-dom'],
  },
})
