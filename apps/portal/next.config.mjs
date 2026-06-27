/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
