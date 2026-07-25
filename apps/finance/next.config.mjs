/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/realtime'],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
}

export default nextConfig
