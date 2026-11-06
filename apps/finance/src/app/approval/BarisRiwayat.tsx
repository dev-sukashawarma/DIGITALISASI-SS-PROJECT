'use client'

import { Building2, ClipboardCheck, Coins, Truck, type LucideIcon } from 'lucide-react'
import { rupiah } from '@/lib/format'
import {
  jamRiwayat,
  labelRiwayat,
  namaPelakuRiwayat,
  type JenisRiwayat,
  type KeputusanRiwayat,
  type RiwayatApproval,
} from '@/lib/approval/riwayat'

/** Ikon jenis sama dengan menu sidebar asalnya. */
export const IKON_JENIS: Record<JenisRiwayat, LucideIcon> = {
  petty_cash: Coins,
  po: ClipboardCheck,
  bayar_vendor: Truck,
  dana_kantor: Building2,
}

/** Warna per keputusan: titik di rel garis waktu & teks status. */
export const WARNA_KEPUTUSAN: Record<KeputusanRiwayat, { titik: string; teks: string }> = {
  setuju: { titik: 'bg-emerald-500', teks: 'text-emerald-700' },
  serah_am: { titik: 'bg-sky-500', teks: 'text-sky-700' },
  tolak: { titik: 'bg-red-500', teks: 'text-red-700' },
}

export function BarisRiwayat({ r }: { r: RiwayatApproval }) {
  const label = labelRiwayat(r)
  const warna = WARNA_KEPUTUSAN[r.keputusan]
  const Ikon = IKON_JENIS[r.jenis]
  const pelaku = namaPelakuRiwayat(r.pelaku_nama)

  return (
    <li className="group relative grid grid-cols-[3.25rem_1.5rem_1fr] gap-x-2 py-3 sm:grid-cols-[3.25rem_1.5rem_1fr_auto] sm:gap-x-3">
      {/* Jam (WIB). Data lama tanpa jam: kolom dibiarkan kosong, tidak dikarang. */}
      <div className="pt-0.5 text-right text-xs font-semibold tabular-nums text-suka-gray-500">
        {r.waktu ? jamRiwayat(r.waktu) : ''}
      </div>

      {/* Titik di rel garis waktu */}
      <div className="relative flex justify-center pt-1.5">
        <span className={`relative z-10 h-2.5 w-2.5 rounded-full ring-4 ring-white ${warna.titik}`} aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-semibold text-suka-ink">{r.judul ?? 'Tanpa nama'}</span>
          <span className={`text-xs font-semibold ${warna.teks}`}>{label.keputusan}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-suka-gray-500">
          <Ikon size={13} className="shrink-0 text-suka-orange" aria-hidden="true" />
          <span className="shrink-0">{label.jenis}</span>
          {r.keterangan && (
            <>
              <span className="text-suka-gray-300" aria-hidden="true">/</span>
              <span className="truncate" title={r.keterangan}>{r.keterangan}</span>
            </>
          )}
        </div>
        {r.alasan && (
          <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
            <span className="font-semibold">Alasan ditolak: </span>
            <span>{r.alasan}</span>
          </p>
        )}
      </div>

      {/* Nominal & pelaku: kolom kanan di desktop, turun ke bawah teks di HP. */}
      <div className="col-start-3 mt-1.5 flex items-baseline justify-between gap-3 sm:col-start-4 sm:row-start-1 sm:mt-0 sm:block sm:text-right">
        <div className="whitespace-nowrap text-sm font-bold tabular-nums text-suka-ink">{r.nominal == null ? '—' : rupiah(r.nominal)}</div>
        <div className={`whitespace-nowrap text-xs text-suka-gray-500 sm:mt-0.5 ${pelaku ? '' : 'italic'}`}>
          {pelaku ?? 'Pelaku tidak tercatat'}
        </div>
      </div>
    </li>
  )
}
