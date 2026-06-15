/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // serverActions graduated from `experimental` to top-level config in Next 15+
  serverActions: {
    bodySizeLimit: '50mb',
  },
}

module.exports = nextConfig
