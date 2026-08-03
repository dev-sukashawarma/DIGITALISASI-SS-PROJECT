import { Globe, Monitor } from 'lucide-react'
import { resolveOrderSource } from '@/lib/order-source'

// Badge sumber pesanan untuk halaman admin (Laporan & Overview).
// Tampilan konsisten dgn halaman Owner & papan Kasir crew. Logika resolusi
// sumber ada di lib/order-source.ts (pure, dipakai juga oleh agregasi analitik).
export default function OrderSourceBadge({
  channel,
  salesSource,
  customerName,
  size = 'sm',
}: {
  channel?: string | null
  salesSource?: string | null
  customerName?: string | null
  size?: 'sm' | 'md'
}) {
  const src = resolveOrderSource(channel, salesSource, customerName)
  const isMd = size === 'md'
  const iconBox = isMd ? 'w-4 h-4' : 'w-3.5 h-3.5'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md ${
        isMd ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
      }`}
      style={{ backgroundColor: src.bg, color: src.fg }}
    >
      {src.logoPath ? (
        <span className={`inline-flex items-center justify-center flex-shrink-0 ${iconBox}`}>
          <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
            <path d={src.logoPath} />
          </svg>
        </span>
      ) : src.lucide === 'globe' ? (
        <Globe className={`${iconBox} flex-shrink-0`} strokeWidth={2.5} />
      ) : src.lucide === 'monitor' ? (
        <Monitor className={`${iconBox} flex-shrink-0`} strokeWidth={2.5} />
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white/25 font-extrabold leading-none ${
            isMd ? 'w-4 h-4 text-[9px]' : 'w-3.5 h-3.5 text-[8px]'
          }`}
        >
          {src.mark}
        </span>
      )}
      {src.label}
    </span>
  )
}
