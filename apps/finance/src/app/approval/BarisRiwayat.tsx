'use client'

import { rupiah } from '@/lib/format'
import { labelRiwayat, teksWaktuRiwayat, type RiwayatApproval } from '@/lib/approval/riwayat'

const WARNA_KEPUTUSAN: Record<RiwayatApproval['keputusan'], string> = {
  setuju: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  serah_am: 'bg-blue-50 text-blue-800 border-blue-200',
  tolak: 'bg-red-50 text-red-700 border-red-200',
}

export function BarisRiwayat({ r }: { r: RiwayatApproval }) {
  const label = labelRiwayat(r)
  return (
    <li className="flex flex-col gap-2 border-b border-suka-brown/5 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${WARNA_KEPUTUSAN[r.keputusan]}`}>
          {label.keputusan}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold text-suka-ink">
            <span className="mr-1.5 text-xs font-medium text-suka-gray-400">{label.jenis}</span>
            {r.judul ?? '-'}
          </div>
          {r.keterangan && <div className="truncate text-xs text-suka-gray-500">{r.keterangan}</div>}
          {r.alasan && <div className="text-xs text-red-700">Alasan: {r.alasan}</div>}
        </div>
      </div>
      <div className="text-left sm:text-right">
        <div className="whitespace-nowrap font-bold text-suka-ink">{r.nominal == null ? '—' : rupiah(Number(r.nominal))}</div>
        <div className="whitespace-nowrap text-[11px] text-suka-gray-400">
          <span className={r.waktu ? '' : 'italic'}>{teksWaktuRiwayat(r.waktu)}</span>
          {' · oleh '}
          {r.pelaku_nama ?? '—'}
        </div>
      </div>
    </li>
  )
}
