/** @type {import('next').NextConfig} */
const nextConfig = {
  // @suka/* di-ekspor sebagai TypeScript src → harus ditranspile Next. (ADR-008)
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/realtime', '@suka/cache'],
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
    // Limit workers to fix EAGAIN on cPanel shared hosting
    cpus: 1,
    workerThreads: false,
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: '/kiosk/qr-login',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

// CATATAN: dulu dibungkus withSerwist (@serwist/next), tapi plugin itu berbasis
// webpack dan TIDAK jalan di build Turbopack (Next 16) — sw.js tidak pernah
// dihasilkan. Sekarang service worker dibundel manual via scripts/build-sw.mjs
// (lifecycle "prebuild") dan diregistrasi oleh components/ServiceWorkerRegister.tsx.
module.exports = nextConfig;
