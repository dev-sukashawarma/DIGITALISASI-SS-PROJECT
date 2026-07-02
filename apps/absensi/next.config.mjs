/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  serverExternalPackages: ['@vladmandic/human'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        // Model wajah (~9MB) di-hash oleh nama file & jarang berubah — cache permanen
        // di device agar kunjungan berikutnya tak download ulang (hemat data & waktu muat).
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
}

export default nextConfig
