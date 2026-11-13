'use client'

import Link from 'next/link'
import { Building2, ClipboardCheck, Coins, ExternalLink, Receipt, Send, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { rupiah, relativeTime, tanggalWaktu } from '@/lib/format'
import { isLama, JENIS_LABEL, type HubItem, type HubJenis } from '@/lib/approval/hub'

/** Ikon per jenis, sama dengan menu sidebar asalnya. */
export const IKON_JENIS_HUB: Record<HubJenis, LucideIcon> = {
  petty_cash: Coins,
  pengeluaran_petty_cash: Receipt,
  kasbon: Wallet,
  serah_am: Send,
  po: ClipboardCheck,
  bayar_vendor: Truck,
  dana_kantor: Building2,
}

const LABEL_SETUJUI: Record<HubJenis, string> = {
  petty_cash: 'Setujui',
  pengeluaran_petty_cash: 'Setujui',
  kasbon: 'Cairkan',
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
  const Ikon = IKON_JENIS_HUB[item.jenis]

  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-x-3 gap-y-3 px-4 py-3.5 sm:grid-cols-[2.25rem_1fr_auto] sm:items-center">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${lama ? 'bg-red-50 text-red-600' : 'bg-suka-orange/10 text-suka-orange'}`}
        aria-hidden="true"
      >
        <Ikon size={17} />
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-suka-ink">{item.judul}</span>
          {item.detailHref && (
            <Link
              href={item.detailHref}
              className="shrink-0 rounded text-suka-gray-400 hover:text-suka-orange focus-visible:outline-2 focus-visible:outline-suka-orange"
              aria-label={`Lihat detail ${item.judul}`}
            >
              <ExternalLink size={13} />
            </Link>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-suka-gray-500">
          <span className="shrink-0 font-medium text-suka-gray-600">{JENIS_LABEL[item.jenis]}</span>
          {item.keterangan && (
            <>
              <span className="text-suka-gray-300" aria-hidden="true">/</span>
              <span className="truncate" title={item.keterangan}>{item.keterangan}</span>
            </>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2.5 text-xs">
          <span
            data-testid="umur-hub"
            title={tanggalWaktu(item.menungguSejak)}
            className={lama ? 'font-semibold text-red-600' : 'text-suka-gray-400'}
          >
            Masuk {relativeTime(item.menungguSejak).toLowerCase()}
          </span>
          {item.jenis === 'pengeluaran_petty_cash' && item.data.receipt_url && (
            <a
              href={item.data.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-suka-orange hover:underline"
            >
              Lihat struk
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* Nominal + tombol: satu baris di bawah teks pada layar HP, kolom kanan di desktop. */}
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
        <span className="whitespace-nowrap text-sm font-bold tabular-nums text-suka-ink">
          {rupiah(item.nominal)}
        </span>
        <div className="flex shrink-0 gap-2">
          {bisaTolak && (
            <button
              type="button"
              onClick={() => onTolak(item)}
              disabled={!bolehPutuskan}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tolak
            </button>
          )}
          <button
            type="button"
            onClick={() => onSetujui(item)}
            disabled={!bolehPutuskan}
            className="rounded-lg bg-suka-brown px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-suka-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange disabled:cursor-not-allowed disabled:opacity-40"
          >
            {LABEL_SETUJUI[item.jenis]}
          </button>
        </div>
      </div>
    </li>
  )
}
