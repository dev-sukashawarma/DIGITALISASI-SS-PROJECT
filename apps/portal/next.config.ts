import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
