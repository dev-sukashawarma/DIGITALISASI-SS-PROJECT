/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
