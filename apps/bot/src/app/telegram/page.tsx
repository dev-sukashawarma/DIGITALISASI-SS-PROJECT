import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { supabaseAdmin } from '@/lib/server/telegram'
import TelegramSettings from './telegram-settings'

export const dynamic = 'force-dynamic'

export default async function HalamanTelegram() {
  const identity = await ambilIdentitasTelegram()
  if (!identity) redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  const { data } = await supabaseAdmin()
    .from('bot_telegram_links')
    .select('telegram_username, linked_at')
    .eq('staff_id', identity.userId)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-cyan-800/50 bg-zinc-900 p-6">
        <a href="/" className="text-sm text-cyan-300 hover:underline">← Kembali ke Bot</a>
        <h1 className="mt-5 text-2xl font-bold">Bot Stokist di Telegram</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Hubungkan akun untuk menerima alert Stok dan Distribusi yang sesuai dengan role dan outlet Anda.
        </p>
        <TelegramSettings
          awalTerhubung={!!data}
          username={data?.telegram_username ?? null}
          botTersedia={!!process.env.TELEGRAM_STOKIST_BOT_TOKEN}
        />
        <p className="mt-6 text-xs text-zinc-400">
          Tautan berlaku 10 menit dan hanya dapat digunakan sekali. Ketik /stop ke bot untuk memutus koneksi.
        </p>
      </div>
    </main>
  )
}
