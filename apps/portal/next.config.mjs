/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig

