import type { NextConfig } from 'next'

// staging build marker — bump untuk memicu redeploy Vercel
const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
} as any

export default nextConfig
