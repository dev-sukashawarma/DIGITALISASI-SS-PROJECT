import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
}

export default nextConfig
