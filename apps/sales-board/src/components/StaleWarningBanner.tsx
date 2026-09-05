import { AlertCircle, RefreshCw } from 'lucide-react'

export function StaleWarningBanner({
  lastOk,
  errorMessage,
}: {
  lastOk: string | null
  errorMessage: string | null
}) {
  const timeFormatted = lastOk
    ? new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(lastOk)) + ' WIB'
    : 'belum ada data'

  return (
    <div
      role="alert"
      className="flex items-center justify-between border-b border-rose-500/30 bg-rose-500/10 px-8 py-2 text-rose-300 backdrop-blur-sm transition-all"
    >
      <div className="flex items-center gap-2.5 text-sm font-semibold">
        <AlertCircle size={17} className="text-rose-400 shrink-0 animate-pulse" />
        <span>
          Pembaruan tertunda &bull; Data terakhir berhasil diperbarui pukul{' '}
          <strong className="text-rose-200 tabular">{timeFormatted}</strong>
          {errorMessage ? ` (${errorMessage})` : ''}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-rose-300/80">
        <RefreshCw size={13} className="animate-spin" />
        <span>Mencoba sinkronisasi otomatis tiap 30 detik...</span>
      </div>
    </div>
  )
}
