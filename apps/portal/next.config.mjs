import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '../../')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
