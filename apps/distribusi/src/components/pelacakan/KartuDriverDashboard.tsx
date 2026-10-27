'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { usePelacakanRealtime, usePerjalananAktif } from '@/hooks/usePelacakanDriver'

/** Kartu ringkas pelacakan di dashboard pusat — pintu masuk ke /distribusi/driver. */
export function KartuDriverDashboard() {
  usePelacakanRealtime()
  const { perjalanan, loading } = usePerjalananAktif()
  if (loading) return null

  const menunggu = perjalanan.reduce((n, p) => n + p.stops.filter((s) => s.status === 'menunggu').length, 0)

  return (
    <Link
      href="/distribusi/driver"
      className="flex items-center justify-between gap-3 rounded-2xl border border-suka-orange/20 bg-white px-4 py-3 shadow-sm transition-all hover:border-suka-orange/50"
    >
      <span className="flex items-center gap-2.5">
        <span className="rounded-xl bg-suka-orange/10 p-2 text-suka-orange">
          <MapPin size={16} />
        </span>
        <span className="text-xs font-black text-suka-ink">
          {perjalanan.length > 0
            ? `${perjalanan.length} driver sedang antar · ${menunggu} SJ menunggu tiba`
            : 'Tidak ada pengantaran berjalan'}
        </span>
      </span>
      <span className="text-[11px] font-black uppercase tracking-wider text-suka-orange">
        {perjalanan.length > 0 ? 'Buka peta' : 'Buka riwayat'}
      </span>
    </Link>
  )
}
