import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  /* config options here */
};

export default nextConfig;
