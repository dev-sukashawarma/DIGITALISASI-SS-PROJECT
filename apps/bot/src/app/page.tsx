import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ambilSesi } from '@/lib/server/sesi'
import KantorApp from '@/components/kantor/KantorApp'

export const dynamic = 'force-dynamic'

// Satu layar: kantor bot + panel chat (spec kantor bot §10).
export default async function Halaman({ searchParams }: { searchParams: Promise<{ layar?: string }> }) {
  const host = (await headers()).get('host') || ''
  const portalUrl = host.includes('localhost') || host.includes('127.0.0.1')
    ? 'http://localhost:3010'
    : process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com'
  const g = await ambilSesi()
  if (!g.ok && g.status === 401) redirect(portalUrl)
  if (!g.ok) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Tidak punya akses</h1>
        <p className="mt-2 text-sm">Kantor Bot hanya untuk owner dan admin.</p>
        <a href={portalUrl} className="mt-4 inline-block rounded-lg bg-suka-orange px-4 py-2 text-sm text-white">Kembali ke portal</a>
      </main>
    )
  }
  const { layar } = await searchParams
  return <KantorApp nama={g.sesi.nama} layarPenuh={layar === 'penuh'} portalUrl={portalUrl} />
}
