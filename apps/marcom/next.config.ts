import type { NextConfig } from "next";
import path from "path";

// In Docker container DOCKER_BUILD is set, in local monorepo resolve to root
const workspaceRoot = process.env.DOCKER_BUILD === "true"
  ? __dirname
  : path.resolve(__dirname, "../../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Turbopack removed — use Webpack (stable with Prisma, avoids module hash bug)
};

export default nextConfig;
