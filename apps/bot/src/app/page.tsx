import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ambilSesi } from '@/lib/server/sesi'
import { LABEL_PROFIL } from '@/lib/peran'
import ChatApp from '@/components/ChatApp'

export const dynamic = 'force-dynamic'

export default async function Halaman() {
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
        <p className="mt-2 text-sm">Bot ini belum dibuka untuk akun Anda.</p>
        <a href={portalUrl} className="mt-4 inline-block rounded-lg bg-suka-orange px-4 py-2 text-sm text-white">Kembali ke portal</a>
      </main>
    )
  }
  return <ChatApp nama={g.sesi.nama} judulBot={LABEL_PROFIL[g.sesi.profil]} portalUrl={portalUrl} />
}
