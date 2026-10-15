import type { NextConfig } from "next";
import path from "path";

// In Docker container DOCKER_BUILD is set, in local monorepo resolve to root
const workspaceRoot = process.env.DOCKER_BUILD === "true"
  ? __dirname
  : path.resolve(__dirname, "../../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    serverActions: {
      // Default 1MB: foto menu 1–5MB ditolak sebelum masuk action dan client
      // hanya menampilkan "An unexpected response was received from the server."
      // Form menu mengizinkan foto ≤5MB (dikompres di browser dulu); sisakan ruang
      // untuk overhead multipart.
      bodySizeLimit: "6mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
