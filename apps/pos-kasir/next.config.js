/** @type {import('next').NextConfig} */
const nextConfig = {
  // @suka/* di-ekspor sebagai TypeScript src → harus ditranspile Next. (ADR-008)
  transpilePackages: ['@suka/auth'],
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
  },
}

module.exports = nextConfig
