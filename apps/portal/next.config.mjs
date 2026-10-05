import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '../../')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: { ignoreBuildErrors: true },
  // URL aset avatar memakai sidik (?v=...) dari klip.gen.ts, jadi aman di-cache selamanya.
  async headers() {
    return [
      {
        source: '/suka-bot/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
