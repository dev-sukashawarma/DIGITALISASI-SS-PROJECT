/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/realtime'],
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'react-icons', 'date-fns'],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['qntuhtkujpwudcpudmbj.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qntuhtkujpwudcpudmbj.supabase.co',
      },
    ],
  },
}

export default nextConfig
