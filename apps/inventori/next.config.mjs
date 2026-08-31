/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  experimental: { optimizePackageImports: ['lucide-react'] },
  typescript: { tsconfigPath: './tsconfig.json' },
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
