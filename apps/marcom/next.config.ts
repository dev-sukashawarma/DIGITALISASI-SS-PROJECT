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
};

export default nextConfig;
