import { redirect } from 'next/navigation'
import { ambilIdentitasTelegram } from '@/lib/server/identitasTelegram'
import { stafBolehPakaiBotApaPun, supabaseAdmin } from '@/lib/server/telegram'
import TelegramSettings from './telegram-settings'
import { Shield, ArrowLeft, ExternalLink, Radio } from 'lucide-react'

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
      <main className="min-h-screen jarvis-bg px-4 py-12 text-zinc-100 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 jarvis-scanlines pointer-events-none opacity-30" />
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-500/40 bg-zinc-950/90 backdrop-blur-xl p-6 shadow-[0_0_35px_rgba(245,158,11,0.18)]">
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400" />

          <a
            href="/"
            className="inline-flex items-center gap-1.5 font-mono-hud text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>KEMBALI KE J.A.R.V.I.S. COMMAND CENTRE</span>
          </a>

          <h1 className="mt-4 font-hud text-lg sm:text-xl font-bold tracking-wider text-amber-300 uppercase">
            Akses Bot Telegram Belum Diberikan
          </h1>
          <p className="mt-2 font-mono-hud text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Hubungi Owner atau Admin untuk mengotorisasi clearance akun staf Anda pada kanal transmisi Bot Telegram.
          </p>
          {isAdmin && (
            <a
              href="https://admin.sukashawarma.com/dashboard/sistem/bot-telegram"
              className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-950/80 border border-cyan-400/50 font-mono-hud text-xs text-cyan-200 hover:bg-cyan-900/80 transition-all"
            >
              <span>Kelola Akses Staf di Admin Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
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
    <main className="min-h-screen jarvis-bg px-4 py-12 text-zinc-100 relative overflow-hidden flex items-center justify-center">
      {/* Subtle Scanlines */}
      <div className="absolute inset-0 jarvis-scanlines pointer-events-none opacity-30" />

      {/* Screen Corner Reticles */}
      <div className="fixed top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="fixed top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
      <div className="fixed bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
      <div className="fixed bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-cyan-400/50 bg-zinc-950/90 backdrop-blur-xl p-6 sm:p-7 shadow-[0_0_45px_rgba(6,182,212,0.22)]">
        {/* Card Reticle Corners */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-cyan-500/20">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/35 font-mono-hud text-xs text-cyan-300 hover:bg-cyan-900/70 hover:border-cyan-400 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>KEMBALI KE J.A.R.V.I.S. HUD</span>
          </a>

          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/40 font-mono-hud text-[10px] text-cyan-300 uppercase tracking-widest">
            <Radio className="w-3 h-3 animate-pulse text-cyan-400" />
            <span>COMMS RELAY // TELEGRAM</span>
          </div>
        </div>

        {/* Title & Identity */}
        <div className="mt-5 flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.3)] shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-hud text-lg sm:text-xl font-black tracking-wider text-white uppercase text-glow-cyan">
              Integrasi Transmisi Telegram
            </h1>
            <p className="mt-1 font-mono-hud text-xs text-cyan-300/80 leading-relaxed">
              Sinkronisasi kanal Bot Telegram untuk menerima **Executive Daily Briefing** dan notifikasi real-time dari J.A.R.V.I.S. Core.
            </p>
          </div>
        </div>

        {loginStatus && loginMessages[loginStatus] && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-400/50 bg-amber-950/40 px-3.5 py-2.5 font-mono-hud text-xs text-amber-200"
          >
            {loginMessages[loginStatus]}
          </div>
        )}

        <TelegramSettings
          awalTerhubung={!!data}
          username={data?.telegram_username ?? null}
        />

        {isAdmin && (
          <div className="mt-5 pt-4 border-t border-cyan-500/20 flex items-center justify-between flex-wrap gap-2">
            <span className="font-mono-hud text-[11px] text-zinc-400">
              OTORISASI ADMIN / OWNER TERDETEKSI
            </span>
            <a
              href="https://admin.sukashawarma.com/dashboard/sistem/bot-telegram"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 border border-cyan-300/50 font-mono-hud text-xs font-bold text-white shadow-[0_0_14px_rgba(6,182,212,0.3)] transition-all"
            >
              <span>Kelola Akses Staf di Admin Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
