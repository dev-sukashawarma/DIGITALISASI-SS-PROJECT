import { Globe, Monitor, Gift, Package } from 'lucide-react'
import { resolveOrderSource } from '@/lib/laba-rugi/order-source'

// Badge sumber pesanan untuk halaman admin (Laporan & Overview).
// Tampilan konsisten dgn halaman Owner & papan Kasir crew. Logika resolusi
// sumber ada di lib/order-source.ts (pure, dipakai juga oleh agregasi analitik).
export default function OrderSourceBadge({
  channel,
  salesSource,
  customerName,
  isEndorse,
  orderType,
  isBigOrder,
  size = 'sm',
}: {
  channel?: string | null
  salesSource?: string | null
  customerName?: string | null
  isEndorse?: boolean | null
  orderType?: string | null
  isBigOrder?: boolean | null
  size?: 'sm' | 'md'
}) {
  const src = resolveOrderSource(channel, salesSource, customerName, isEndorse)
  const isMd = size === 'md'
  const iconBox = isMd ? 'w-4 h-4' : 'w-3.5 h-3.5'

  // Penanda Pre-Order WA: pesanan WA/telepon "[Jam Ambil]". Dihitung sebagai
  // Offline/POS Kasir (badge utama), pill ini hanya menandainya.
  const isPreorderWa = (channel || '').trim().toLowerCase() === 'preorder_wa'
  const preorderPill = isPreorderWa ? (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 ${
        isMd ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5'
      }`}
      title="Pesanan WhatsApp/telepon, dihitung sebagai Offline"
    >
      Pre-Order WA
    </span>
  ) : null

  const showBigOrder = Boolean(isBigOrder || (orderType || '').trim().toLowerCase() === 'big_order')
  const bigOrderPill = showBigOrder ? (
    <span
      className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wider rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 ${
        isMd ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5'
      }`}
      title="Big Order — Potongan diskon 15% otomatis dari total transaksi"
    >
      <Package className={isMd ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-3 shrink-0'} strokeWidth={2.5} />
      Big Order -15%
    </span>
  ) : null

  const badge = (
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
      ) : src.lucide === 'gift' ? (
        <Gift className={`${iconBox} flex-shrink-0`} strokeWidth={2.5} />
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

  if (!preorderPill && !bigOrderPill) return badge
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {badge}
      {preorderPill}
      {bigOrderPill}
    </span>
  )
}
