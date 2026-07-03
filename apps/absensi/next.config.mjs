/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue'],
  serverExternalPackages: ['@vladmandic/human'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
