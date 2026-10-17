import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiBotApaPun, supabaseAdmin } from '@/lib/server/telegram'
import TelegramSettings from './telegram-settings'

export const dynamic = 'force-dynamic'

const loginMessages: Record<string, string> = {
  connected: 'Telegram berhasil dihubungkan.',
  denied: 'Akses bot Telegram belum diberikan untuk akun staf ini.',
  invite_required: 'ID Telegram Anda perlu dimasukkan admin sebelum bisa memakai bot.',
  invalid: 'Verifikasi Telegram gagal atau sudah kedaluwarsa. Coba lagi.',
  unavailable: 'Pengaitan Telegram sedang tidak tersedia.',
  used: 'Akun Telegram ini sudah terhubung ke staf lain.',
}

export default async function HalamanTelegram({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const identity = await ambilIdentitasTelegram()
  if (!identity) redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  const isAdmin = ['owner', 'admin'].includes(identity.role)
  const loginStatus = (await searchParams).login
  const allowed = await stafBolehPakaiBotApaPun(identity.userId)
  if (!allowed) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <h1 className="text-xl font-bold">Akses bot Telegram belum diberikan</h1>
          <p className="mt-2 text-sm text-zinc-300">Hubungi owner atau admin untuk meminta akses ke bot yang sesuai dengan pekerjaan Anda.</p>
          {isAdmin && <a href="https://admin.sukashawarma.com/dashboard/sistem/bot-telegram" className="mt-4 inline-block text-sm text-cyan-300 hover:underline">Kelola akses staf di Admin Dashboard →</a>}
        </div>
      </main>
    )
  }
  const { data } = await supabaseAdmin()
    .from('bot_telegram_links')
    .select('telegram_username, linked_at')
    .eq('staff_id', identity.userId)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-cyan-800/50 bg-zinc-900 p-6">
        <a href="/" className="text-sm text-cyan-300 hover:underline">← Kembali ke Bot</a>
        <h1 className="mt-5 text-2xl font-bold">Hubungkan Telegram</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Admin mengatur akses bot dan menautkan ID Telegram Anda. Jika belum bisa memakai bot, hubungi admin.
        </p>
        {isAdmin && <a href="https://admin.sukashawarma.com/dashboard/sistem/bot-telegram" className="mt-3 inline-block text-sm text-cyan-300 hover:underline">Kelola akses staf di Admin Dashboard →</a>}
        {loginStatus && loginMessages[loginStatus] && <p role="status" className="mt-4 text-sm text-amber-300">{loginMessages[loginStatus]}</p>}
        <TelegramSettings
          awalTerhubung={!!data}
          username={data?.telegram_username ?? null}
        />
      </div>
    </main>
  )
}
