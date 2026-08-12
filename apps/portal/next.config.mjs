/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
