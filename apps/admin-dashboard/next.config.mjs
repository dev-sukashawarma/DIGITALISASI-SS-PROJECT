/** @type {import('next').NextConfig} */
const nextConfig = {
  // JANGAN tambahkan `output: 'standalone'`. Deploy cPanel di sini mem-boot lewat
  // `server.cjs` custom (next({ dev:false, dir })), bukan `.next/standalone/server.js`.
  // Saat `standalone` aktif (masuk 31 Jul via commit sapu-jagat 79dbcb9b), middleware
  // berhenti menegakkan auth di produksi — semua route terproteksi balas 200 tanpa login —
  // dan `/` balas 500. Empat app lain (stok/absensi/distribusi/finance) tanpa `output`
  // dan semuanya sehat. Lihat ADR-008.
  transpilePackages: ['@suka/auth', '@suka/design-system', '@suka/realtime'],
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'react-icons', 'date-fns'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qntuhtkujpwudcpudmbj.supabase.co',
      },
    ],
  },
}

export default nextConfig
