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
  // Catatan: upload ZIP ditangani via route handler App Router (/api/zip-upload),
  // yang membaca body secara streaming tanpa batas 1MB — jadi tidak perlu
  // `serverActions.bodySizeLimit` (key itu invalid di Next 16 & app ini tak punya server action).
}

module.exports = nextConfig
