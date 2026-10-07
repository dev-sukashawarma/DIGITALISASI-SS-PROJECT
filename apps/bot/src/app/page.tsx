import { redirect } from 'next/navigation'
import { ambilSesi } from '@/lib/server/sesi'
import { LABEL_PROFIL } from '@/lib/peran'
import ChatApp from '@/components/ChatApp'

export const dynamic = 'force-dynamic'

export default async function Halaman() {
  const g = await ambilSesi()
  if (!g.ok && g.status === 401) redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  if (!g.ok) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Tidak punya akses</h1>
        <p className="mt-2 text-sm">Bot ini saat ini hanya untuk owner dan admin.</p>
      </main>
    )
  }
  return <ChatApp nama={g.sesi.nama} judulBot={LABEL_PROFIL[g.sesi.profil]} />
}
