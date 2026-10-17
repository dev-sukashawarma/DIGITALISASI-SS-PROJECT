import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import AccessSettings from './access-settings'

export const dynamic = 'force-dynamic'

export default async function HalamanAksesStokist() {
  const identity = await ambilIdentitasTelegram()
  if (!identity || !['owner', 'admin'].includes(identity.role)) redirect('/telegram')
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl rounded-2xl border border-cyan-800/50 bg-zinc-900 p-6">
        <a href="/telegram" className="text-sm text-cyan-300 hover:underline">← Kembali</a>
        <h1 className="mt-5 text-2xl font-bold">Akses Bot Stokist</h1>
        <p className="mt-2 text-sm text-zinc-300">Pilih staf yang boleh menautkan Telegram dan menerima alert Stok & Distribusi.</p>
        <AccessSettings />
        <p className="mt-5 text-xs text-amber-300">Akses chat dikelola terpisah oleh allowlist Telegram pada profil Hermes. Samakan User ID Telegram staf terpilih di sana; hapus dari allowlist ketika akses dicabut.</p>
      </div>
    </main>
  )
}
