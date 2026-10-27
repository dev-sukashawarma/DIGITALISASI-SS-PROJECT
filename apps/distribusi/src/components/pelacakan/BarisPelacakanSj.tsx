'use client'

import Link from 'next/link'
import { Truck } from 'lucide-react'
import { useStatusAntarSj, useStopSj } from '@/hooks/usePelacakanDriver'
import { formatJamWib, kalimatOutlet, labelStop } from '@/lib/pelacakan/statusStop'

const DALAM_TRANSIT = ['dikirim', 'dikirim_lengkap']

/**
 * Satu baris status pengantaran untuk satu SJ.
 * - Pusat (`tampilan="pusat"`): driver, jam berangkat, status stop + tautan peta.
 * - Outlet (`tampilan="outlet"`): kalimat ringkas dari RPC, tanpa koordinat.
 */
export function BarisPelacakanSj({
  sjId,
  statusSj,
  tampilan,
  tautPeta = true,
}: {
  sjId: string
  statusSj: string
  tampilan: 'pusat' | 'outlet'
  tautPeta?: boolean
}) {
  const pusat = tampilan === 'pusat'
  const { stop } = useStopSj(sjId, pusat)
  const { status } = useStatusAntarSj(sjId, !pusat && DALAM_TRANSIT.includes(statusSj))

  if (!pusat) {
    const kalimat = status ? kalimatOutlet(status) : null
    if (!kalimat) return null
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
        <Truck size={12} className="shrink-0" /> {kalimat}
      </p>
    )
  }

  if (!stop) {
    if (!DALAM_TRANSIT.includes(statusSj)) return null
    return <p className="text-[11px] font-bold text-suka-gray-500">Pengantaran tidak dilacak</p>
  }

  const p = stop.perjalanan
  const label = labelStop(stop)
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold text-suka-ink">
      <Truck size={12} className="shrink-0 text-suka-orange" />
      Dibawa {p?.driver?.name?.split(/\s+/)[0] ?? 'driver'}
      {p?.berangkat_at && ` · berangkat ${formatJamWib(p.berangkat_at)}`} · {label.teks}
      {tautPeta && (
        <Link href="/distribusi/driver" className="text-suka-orange hover:underline">
          lihat di peta
        </Link>
      )}
    </p>
  )
}
