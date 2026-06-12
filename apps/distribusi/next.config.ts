import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
} as any

export default nextConfig
