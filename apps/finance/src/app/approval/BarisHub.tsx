'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { rupiah, relativeTime, tanggalWaktu } from '@/lib/format'
import { isLama, JENIS_LABEL, type HubItem, type HubJenis } from '@/lib/approval/hub'

export const WARNA_JENIS: Record<HubJenis, string> = {
  petty_cash: 'bg-orange-50 text-orange-800 border-orange-200',
  serah_am: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  po: 'bg-blue-50 text-blue-800 border-blue-200',
  bayar_vendor: 'bg-green-50 text-green-800 border-green-200',
  dana_kantor: 'bg-purple-50 text-purple-800 border-purple-200',
}

const LABEL_SETUJUI: Record<HubJenis, string> = {
  petty_cash: 'Setujui',
  serah_am: 'Serahkan ke AM',
  po: 'Setujui',
  bayar_vendor: 'Setujui',
  dana_kantor: 'Verifikasi',
}

export function BarisHub({
  item,
  now,
  bolehPutuskan,
  onSetujui,
  onTolak,
}: {
  item: HubItem
  now: Date
  bolehPutuskan: boolean
  onSetujui: (i: HubItem) => void
  onTolak: (i: HubItem) => void
}) {
  const lama = isLama(item.menungguSejak, now)
  const bisaTolak = item.jenis !== 'serah_am'

  return (
    <li className="flex flex-col gap-3 border-b border-suka-brown/5 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${WARNA_JENIS[item.jenis]}`}>
          {JENIS_LABEL[item.jenis]}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-suka-ink">
            <span className="truncate">{item.judul}</span>
            {item.detailHref && (
              <Link href={item.detailHref} className="text-suka-gray-400 hover:text-suka-orange" aria-label="Lihat detail">
                <ExternalLink size={13} />
              </Link>
            )}
          </div>
          {item.keterangan && <div className="truncate text-xs text-suka-gray-500">{item.keterangan}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <div className="whitespace-nowrap font-bold text-suka-ink">{rupiah(item.nominal)}</div>
          <div
            data-testid="umur-hub"
            title={tanggalWaktu(item.menungguSejak)}
            className={`whitespace-nowrap text-[11px] ${lama ? 'font-bold text-red-600' : 'text-suka-gray-400'}`}
          >
            {relativeTime(item.menungguSejak)}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {bisaTolak && (
            <button
              type="button"
              onClick={() => onTolak(item)}
              disabled={!bolehPutuskan}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tolak
            </button>
          )}
          <button
            type="button"
            onClick={() => onSetujui(item)}
            disabled={!bolehPutuskan}
            className="rounded-lg bg-suka-brown px-3 py-1.5 text-xs font-semibold text-white hover:bg-suka-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {LABEL_SETUJUI[item.jenis]}
          </button>
        </div>
      </div>
    </li>
  )
}
