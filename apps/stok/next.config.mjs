import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue', '@suka/realtime'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Turbopack native alias — Next.js 16 uses Turbopack unconditionally for
  // `next build`. A relative resolveAlias value ('./src') is resolved against
  // Turbopack's auto-detected monorepo root (nearest yarn.lock upward, i.e.
  // /repo), NOT this config file's directory — this is a documented Turbopack
  // monorepo gotcha (vercel/next.js#88579, #86431), and it's what silently
  // broke @/* resolution despite working in ad-hoc local builds. Using an
  // absolute path removes the ambiguity entirely.
  turbopack: {
    resolveAlias: {
      '@': path.join(__dirname, 'src'),
    },
  },
}

export default nextConfig
