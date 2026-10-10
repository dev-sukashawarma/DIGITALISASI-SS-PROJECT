import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ambilSesi } from '@/lib/server/sesi'
import JarvisApp from '@/components/jarvis/JarvisApp'

export const dynamic = 'force-dynamic'

export default async function Halaman() {
  const host = (await headers()).get('host') || ''
  const portalUrl =
    host.includes('localhost') || host.includes('127.0.0.1')
      ? 'http://localhost:3010'
      : process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'

  const g = await ambilSesi()
  if (!g.ok && g.status === 401) redirect(portalUrl)
  if (!g.ok) {
    return (
      <main className="mx-auto max-w-md p-6 text-center text-zinc-100 min-h-screen flex flex-col items-center justify-center jarvis-bg">
        <h1 className="text-xl font-bold font-hud text-red-400">ACCESS RESTRICTED</h1>
        <p className="mt-2 text-sm text-zinc-400">SukaShawarma Command Centre hanya untuk clearance Owner & Admin.</p>
        <a
          href={portalUrl}
          className="mt-4 inline-block rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm text-white font-semibold transition-colors"
        >
          Kembali ke Portal
        </a>
      </main>
    )
  }

  return (
    <JarvisApp
      nama={g.sesi.nama}
      portalUrl={portalUrl}
    />
  )
}
