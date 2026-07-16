/** @type {import('next').NextConfig} */
const nextConfig = {
  // @suka/* di-ekspor sebagai TypeScript src → harus ditranspile Next. (ADR-008)
  transpilePackages: ['@suka/auth', '@suka/realtime'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage CDN
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Increase body size limit for ZIP uploads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Tree-shake barrel imports → smaller client bundles
    optimizePackageImports: ['recharts', 'lucide-react'],
  },
  turbopack: {},
}

// CATATAN: dulu dibungkus withSerwist (@serwist/next), tapi plugin itu berbasis
// webpack dan TIDAK jalan di build Turbopack (Next 16) — sw.js tidak pernah
// dihasilkan. Sekarang service worker dibundel manual via scripts/build-sw.mjs
// (lifecycle "prebuild") dan diregistrasi oleh components/ServiceWorkerRegister.tsx.
module.exports = nextConfig;
