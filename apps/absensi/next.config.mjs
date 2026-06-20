/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  serverExternalPackages: ['@vladmandic/human'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig

