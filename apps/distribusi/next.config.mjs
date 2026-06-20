/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig

