import { CheckCircle2, Terminal } from 'lucide-react'

type Props = { awalTerhubung: boolean; username: string | null }

export default function TelegramSettings({ awalTerhubung, username }: Props) {
  return (
    <section className="mt-5 space-y-3 font-mono-hud">
      {awalTerhubung ? (
        <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/35 p-4 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-emerald-300">
                ✓ KANAL TELEGRAM TERHUBUNG {username ? `(@${username})` : ''}
              </p>
              <p className="text-[11px] text-emerald-200/75 mt-0.5">
                Siap menerima broadcast Executive Daily Briefing & perintah suara/teks J.A.R.V.I.S.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-900/70 border border-emerald-400/40 text-[10px] text-emerald-200 font-bold uppercase shrink-0">
            ONLINE
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-cyan-500/30 bg-black/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>MENUNGGU PENAUTAN ID TELEGRAM</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Admin akan memasukkan ID Telegram Anda di panel kontrol. Setelah terdaftar, buka bot Telegram yang diberikan dan tekan <span className="text-cyan-300 font-bold">/start</span>.
          </p>
        </div>
      )}
    </section>
  )
}
