import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '../../')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  typescript: { tsconfigPath: './tsconfig.json', ignoreBuildErrors: true },
  experimental: {
    // Bound prerender workers on the shared VPS. Type checking stays enabled.
    cpus: 1,
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
