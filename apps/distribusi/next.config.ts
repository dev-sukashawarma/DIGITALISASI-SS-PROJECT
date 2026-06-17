import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
