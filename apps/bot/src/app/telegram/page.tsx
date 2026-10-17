import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiStokist, supabaseAdmin } from '@/lib/server/telegram'
import TelegramSettings from './telegram-settings'

export const dynamic = 'force-dynamic'

const loginMessages: Record<string, string> = {
  connected: 'Telegram berhasil dihubungkan.',
  denied: 'Akses Bot Stokist belum diberikan untuk akun staf ini.',
  invalid: 'Verifikasi Telegram gagal atau sudah kedaluwarsa. Coba lagi.',
  unavailable: 'Pengaitan Telegram sedang tidak tersedia.',
  used: 'Akun Telegram ini sudah terhubung ke staf lain.',
}

export default async function HalamanTelegram({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  const identity = await ambilIdentitasTelegram()
  if (!identity) redirect(process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com')
  const isAdmin = ['owner', 'admin'].includes(identity.role)
  const loginStatus = (await searchParams).login
  const allowed = await stafBolehPakaiStokist(identity.userId)
  if (!allowed) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <h1 className="text-xl font-bold">Akses Bot Stokist belum diberikan</h1>
          <p className="mt-2 text-sm text-zinc-300">Hubungi owner atau admin jika Anda perlu menerima alert Stok & Distribusi.</p>
          {isAdmin && <a href="/telegram/akses" className="mt-4 inline-block text-sm text-cyan-300 hover:underline">Kelola akses staf →</a>}
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
        <h1 className="mt-5 text-2xl font-bold">Bot Stokist di Telegram</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Hubungkan Telegram untuk menerima alert sesuai role dan outlet Anda. User bot yang diizinkan dapat bertanya tentang Stok dan Distribusi lintas outlet.
        </p>
        {isAdmin && <a href="/telegram/akses" className="mt-3 inline-block text-sm text-cyan-300 hover:underline">Kelola akses staf →</a>}
        {loginStatus && loginMessages[loginStatus] && <p role="status" className="mt-4 text-sm text-amber-300">{loginMessages[loginStatus]}</p>}
        <TelegramSettings
          awalTerhubung={!!data}
          username={data?.telegram_username ?? null}
          botTersedia={!!process.env.TELEGRAM_STOKIST_BOT_TOKEN}
          loginTersedia={!!(process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_ID && process.env.TELEGRAM_STOKIST_LOGIN_CLIENT_SECRET && process.env.TELEGRAM_STOKIST_LOGIN_REDIRECT_URI)}
        />
        <p className="mt-6 text-xs text-zinc-400">
          Jika memakai kode manual, kirim /start lalu /id ke bot Stokist. Kode berlaku 10 menit. Putuskan koneksi dari halaman ini.
        </p>
      </div>
    </main>
  )
}
