import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
