import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
