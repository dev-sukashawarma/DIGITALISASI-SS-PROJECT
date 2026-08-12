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
  // Turbopack native alias — Next.js 16 uses Turbopack by default for builds.
  // tsconfig paths are misresolved from monorepo root; this ensures @/* always
  // points to the correct apps/stok/src/ directory.
  turbopack: {
    resolveAlias: {
      '@': './src',
    },
  },
}

export default nextConfig
