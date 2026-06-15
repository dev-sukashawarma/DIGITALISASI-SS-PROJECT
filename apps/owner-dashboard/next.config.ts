import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
