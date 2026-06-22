/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  experimental: {
    // Workaround for React 18 incompatibility with error page prerendering
    optimizePackageImports: ['lucide-react', 'sonner'],
  },
}

export default nextConfig

