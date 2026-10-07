import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(__dirname, '../../')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@suka/auth', '@suka/design-system'],
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  typescript: { tsconfigPath: './tsconfig.json' },
}

export default nextConfig
