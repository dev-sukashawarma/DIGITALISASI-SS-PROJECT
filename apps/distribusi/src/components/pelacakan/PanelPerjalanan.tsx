'use client'

import Link from 'next/link'
import { formatJamWib, kesegaranLokasi, labelStop, type Nada } from '@/lib/pelacakan/statusStop'
import { jarakJejakKm } from '@/lib/pelacakan/jejak'
import type { PerjalananTampil, TitikJejak } from '@/lib/pelacakan/types'

const KELAS_NADA: Record<Nada, string> = {
  ok: 'text-suka-green',
  peringatan: 'text-amber-600',
  buruk: 'text-red-600',
  netral: 'text-suka-gray-500',
}

const STATUS_PERJALANAN: Record<string, string> = {
  berjalan: 'Sedang mengantar',
  selesai: 'Selesai',
  ditutup_otomatis: 'Ditutup otomatis (21:00)',
}

export function PanelPerjalanan({
  p,
  jejak,
  dipilih,
  onPilih,
}: {
  p: PerjalananTampil
  jejak: TitikJejak[]
  dipilih: boolean
  onPilih: () => void
}) {
  const km = p.total_km != null ? Number(p.total_km) : dipilih ? jarakJejakKm(jejak) : null
  const segar = p.terkini ? kesegaranLokasi(p.terkini.direkam_at) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPilih}
      onKeyDown={(e) => e.key === 'Enter' && onPilih()}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all cursor-pointer ${
        dipilih ? 'border-suka-orange ring-2 ring-suka-orange/30' : 'border-suka-brown/10 hover:border-suka-orange/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-suka-ink">{p.driver_name}</p>
          <p className="text-[11px] font-bold text-suka-gray-500">
            {STATUS_PERJALANAN[p.status] ?? p.status} · berangkat {formatJamWib(p.berangkat_at)}
            {km != null && ` · ${km.toFixed(1).replace('.', ',')} km`}
          </p>
        </div>
        {segar && p.status === 'berjalan' && (
          <span className={`text-[10px] font-black ${KELAS_NADA[segar.nada]}`}>{segar.teks}</span>
        )}
      </div>

      <ol className="mt-3 space-y-1.5">
        {p.stops.map((s) => {
          const label = labelStop(s)
          return (
            <li key={s.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-bold text-suka-ink">
                {s.urutan}. {s.outlet_name}{' '}
                <Link
                  href={`/distribusi/surat-jalan/${s.surat_jalan_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-suka-orange hover:underline"
                >
                  {s.document_number ?? 'SJ'}
                </Link>
              </span>
              <span className={`shrink-0 font-bold ${KELAS_NADA[label.nada]}`}>{label.teks}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
