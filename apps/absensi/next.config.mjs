import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/offline-queue', '@suka/pwa'],
  serverExternalPackages: ['@vladmandic/human'],
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['127.0.0.1'],
}

export default withSerwist(nextConfig)

