/** @type {import('next').NextConfig} */

const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
}

export default nextConfig

