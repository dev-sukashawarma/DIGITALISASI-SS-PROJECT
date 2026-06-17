import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
